import datetime
import http
import re
import oauthlib.common
import uuid
import json
import typing
from sqlalchemy.ext.asyncio import AsyncSession
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse
from starlette.requests import Request
from starlette.responses import Response
from eave.core.internal.orm.github_installation import GithubInstallationOrm
from eave.core.internal.orm.team import TeamOrm

import eave.pubsub_schemas
from eave.stdlib import auth_cookies, utm_cookies
from eave.stdlib.core_api.models.account import AuthProvider
from eave.stdlib.core_api.models.github_repos import (
    GithubRepoFeatureState,
)
from eave.stdlib.github_api.operations.tasks import RunApiDocumentationTask
from eave.stdlib.headers import EAVE_REQUEST_ID_HEADER, EAVE_TEAM_ID_HEADER
from eave.stdlib.logging import LogContext, eaveLogger
from eave.stdlib.request_state import EaveRequestState
from eave.stdlib.eave_origins import EaveApp
from eave.stdlib.github_api.models import ExternalGithubRepo, GithubRepoInput
from eave.stdlib.github_api.operations.query_repos import QueryGithubRepos
import eave.stdlib.slack
import eave.stdlib.cookies
import eave.stdlib.analytics
import eave.stdlib.exceptions
import eave.stdlib.config
from eave.stdlib.task_queue import create_task
from eave.stdlib.util import ensure_uuid
from eave.stdlib.github_api.operations.verify_installation import VerifyInstallation
from eave.stdlib.core_api.models.integrations import Integration
from eave.core.internal import app_config, database
from eave.core.internal.orm import AccountOrm, GithubRepoOrm
import eave.core.internal.oauth.state_cookies
from . import EaveOnboardingErrorCode, EAVE_ERROR_CODE_QP

DEFAULT_REDIRECT_LOCATION = f"{app_config.eave_public_www_base}/dashboard"
SIGNUP_REDIRECT_LOCATION = f"{app_config.eave_public_www_base}/signup"

gh_app_state_cookie_name = "ev_state_blob"


def verify_oauth_state_or_exception(
    state: typing.Optional[str],
    auth_provider: AuthProvider,
    request: Request,
    response: Response,
) -> typing.Literal[True]:
    # verify request not tampered
    cookie_state = eave.core.internal.oauth.state_cookies.get_state_cookie(request=request, provider=auth_provider)
    eave.core.internal.oauth.state_cookies.delete_state_cookie(response=response, provider=auth_provider)

    if not state or not cookie_state or state != cookie_state:
        raise eave.stdlib.exceptions.InvalidStateError()

    return True


async def verify_stateless_installation_or_exception(
    code: str,
    installation_id: str,
    ctx: LogContext,
) -> None:
    """
    When the GitHub app is installed through the GitHub marketplace, it doesnt give us
    the opportunity to set/generate a state cookie for us to verify against mitm tampering,
    so we have to manually validate that the user has access to the app installation.

    code - user OAuth code for requesting an access_token
            https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app#generating-a-user-access-token-when-a-user-installs-your-app

    installation_id - (Eave) github app installation id
    """
    await VerifyInstallation.perform(
        input=VerifyInstallation.RequestBody(code=code, installation_id=installation_id),
        origin=EaveApp.eave_api,
        ctx=ctx,
    )


def set_redirect(response: Response, location: str) -> Response:
    response.headers["Location"] = location
    response.status_code = http.HTTPStatus.TEMPORARY_REDIRECT
    return response


def set_error_code(response: Response, error_code: EaveOnboardingErrorCode) -> Response:
    location_header = response.headers["Location"]
    location = urlparse(location_header)
    qs = parse_qs(location.query)
    qs.update({EAVE_ERROR_CODE_QP: [error_code.value]})
    qs_updated = urlencode(qs, doseq=True)
    location = location._replace(query=qs_updated)
    return set_redirect(response=response, location=urlunparse(location))


def is_error_response(response: Response) -> bool:
    location_header = response.headers["Location"]
    location = urlparse(location_header)
    qs = parse_qs(location.query)
    return qs.get(EAVE_ERROR_CODE_QP) is not None


def cancel_flow(response: Response) -> Response:
    return set_redirect(response=response, location=eave.core.internal.app_config.eave_public_www_base)


async def get_logged_in_eave_account(
    request: Request,
    auth_provider: AuthProvider,
    access_token: str,
    refresh_token: typing.Optional[str],
) -> typing.Optional[eave.core.internal.orm.AccountOrm]:
    """
    Check if the user is logged in, and if so, get the account associated with the provided access token and account ID.
    """
    auth_cookies_ = auth_cookies.get_auth_cookies(cookies=request.cookies)

    if auth_cookies_.access_token and auth_cookies_.account_id:
        async with eave.core.internal.database.async_session.begin() as db_session:
            eave_account = await eave.core.internal.orm.AccountOrm.one_or_none(
                session=db_session,
                params=AccountOrm.QueryParams(
                    id=ensure_uuid(auth_cookies_.account_id),
                    access_token=auth_cookies_.access_token,
                    auth_provider=auth_provider,
                ),
            )

            if not eave_account:
                # The access token or account ID are invalid. Treat this user as signed out.
                return None

            if eave_account.auth_provider == auth_provider:
                eave_account.set_tokens(session=db_session, access_token=access_token, refresh_token=refresh_token)

        return eave_account

    else:
        return None


async def get_existing_eave_account(
    auth_provider: AuthProvider,
    auth_id: str,
    access_token: str,
    refresh_token: typing.Optional[str],
) -> typing.Optional[eave.core.internal.orm.AccountOrm]:
    """
    Check for existing account with the given provider and ID.
    Also updates access_token and refresh_token in the database.
    """
    async with eave.core.internal.database.async_session.begin() as db_session:
        eave_account = await eave.core.internal.orm.AccountOrm.one_or_none(
            session=db_session,
            params=AccountOrm.QueryParams(
                auth_provider=auth_provider,
                auth_id=auth_id,
            ),
        )

        if eave_account:
            # An account exists. Update the saved auth tokens and login date.
            eave_account.last_login = datetime.datetime.utcnow()
            eave_account.set_tokens(session=db_session, access_token=access_token, refresh_token=refresh_token)

    return eave_account


async def create_new_account_and_team(
    request: Request,
    eave_team_name: str,
    user_email: str | None,
    auth_provider: AuthProvider,
    auth_id: str,
    access_token: str,
    refresh_token: typing.Optional[str],
) -> eave.core.internal.orm.AccountOrm:
    eave_state = EaveRequestState.load(request=request)
    tracking_cookies = utm_cookies.get_tracking_cookies(request=request)

    async with eave.core.internal.database.async_session.begin() as db_session:
        eave_team = await eave.core.internal.orm.TeamOrm.create(
            session=db_session,
            name=eave_team_name,
            document_platform=None,
        )

        eave_account = await eave.core.internal.orm.AccountOrm.create(
            session=db_session,
            team_id=eave_team.id,
            visitor_id=tracking_cookies.visitor_id,
            opaque_utm_params=tracking_cookies.utm_params,
            auth_provider=auth_provider,
            auth_id=auth_id,
            access_token=access_token,
            refresh_token=refresh_token,
            email=user_email,
        )

    eaveLogger.debug(
        "created new account",
        eave_state.ctx,
        {"eave_account_id": str(eave_account.id), "eave_team_id": str(eave_team.id)},
    )

    await eave.stdlib.analytics.log_event(
        event_name="eave_account_registration",
        event_description="A new account was created",
        event_source="core api oauth",
        eave_account=eave_account.analytics_model,
        eave_team=eave_team.analytics_model,
        ctx=eave_state.ctx,
    )

    try:
        # TODO: This should happen in a pubsub subscriber on the "eave_account_registration" event.
        # Notify #sign-ups Slack channel.

        if user_email and re.search("@eave.fyi$", user_email):
            channel_id = "C04GDPU3B5Z"  # #bot-testing in eave slack
        else:
            channel_id = "C04HH2N08LD"  # #sign-ups in eave slack

        slack_client = eave.stdlib.slack.get_authenticated_eave_system_slack_client()
        slack_response = await slack_client.chat_postMessage(
            channel=channel_id,
            text="Someone registered for Eave!",
        )

        await slack_client.chat_postMessage(
            channel=channel_id,
            thread_ts=slack_response.get("ts"),
            text=(
                f"Auth Provider: `{auth_provider.value}`\n"
                f"Email: `{user_email}`\n"
                f"Account ID: `{eave_account.id}`\n"
                f"Visitor ID: `{eave_account.visitor_id}`\n"
                f"Eave Team Name: `{eave_team.name}`\n"
                f"UTM Params:\n"
                f"```{eave_account.opaque_utm_params}```"
            ),
        )
    except Exception as e:
        eaveLogger.exception(e, eave_state.ctx)

    return eave_account


async def get_or_create_eave_account(
    request: Request,
    response: Response,
    eave_team_name: str,
    user_email: typing.Optional[str],
    auth_provider: AuthProvider,
    auth_id: str,
    access_token: str,
    refresh_token: typing.Optional[str],
) -> eave.core.internal.orm.AccountOrm:
    eave_account = await get_logged_in_eave_account(
        request=request,
        auth_provider=auth_provider,
        access_token=access_token,
        refresh_token=refresh_token,
    )

    if not eave_account:
        # User is not logged in.
        eave_account = await get_existing_eave_account(
            auth_provider=auth_provider,
            auth_id=auth_id,
            access_token=access_token,
            refresh_token=refresh_token,
        )

    if not eave_account:
        # Create an account
        eave_account = await create_new_account_and_team(
            request=request,
            eave_team_name=eave_team_name,
            user_email=user_email,
            auth_provider=auth_provider,
            auth_id=auth_id,
            access_token=access_token,
            refresh_token=refresh_token,
        )

    # Set the cookie in the response headers.
    # This logs the user into their Eave account,
    # or updates the cookies if they were already logged in.
    auth_cookies.set_auth_cookies(
        response=response,
        account_id=eave_account.id,
        team_id=eave_account.team_id,
        access_token=eave_account.access_token,
    )

    set_redirect(response=response, location=DEFAULT_REDIRECT_LOCATION)
    return eave_account


def generate_and_set_state_cookie(
    response: Response,
    installation_id: str,
) -> str:
    state = generate_rand_state()
    state_blob = json.dumps({"install_flow_state": state, "install_id": installation_id})
    eave.stdlib.cookies.set_http_cookie(response=response, key=gh_app_state_cookie_name, value=state_blob)
    return state


async def try_associate_account_with_dangling_github_installation(
    request: Request,
    response: Response,
    team_id: uuid.UUID,
) -> None:
    request_state = EaveRequestState.load(request=request)
    state_blob = request.cookies.get(gh_app_state_cookie_name)

    if not state_blob:
        return

    # delete cookie now that we've used it
    eave.stdlib.cookies.delete_http_cookie(response=response, key=gh_app_state_cookie_name)

    state_blob = json.loads(state_blob)

    state = state_blob.get("install_flow_state")
    installation_id = state_blob.get("install_id")
    if not state or not installation_id:
        return

    async with eave.core.internal.database.async_session.begin() as db_session:
        installation = await GithubInstallationOrm.query(
            session=db_session,
            params=eave.core.internal.orm.GithubInstallationOrm.QueryParams(
                github_install_id=installation_id,
            ),
        )

        if not installation or installation.install_flow_state != state:
            eaveLogger.warning("GitHub app installation state did not match cookies state", request_state.ctx)
            return

        team = await TeamOrm.one_or_exception(
            session=db_session,
            team_id=team_id,
        )

        # associate installation w/ team (and erase state value)
        installation.update(team_id=team_id, install_flow_state=None, session=db_session)

    eaveLogger.debug("account associated with a github app installation", request_state.ctx)

    await eave.stdlib.analytics.log_event(
        event_name="eave_application_integration",
        event_description="An integration was added for a team",
        event_source="core api oauth",
        eave_team=team.analytics_model,
        opaque_params={
            "integration_name": Integration.github.value,
            "auth_callback_url": str(request.url),
            "late_association": True,
            "installation_id": installation_id,
        },
        ctx=request_state.ctx,
    )

    # now that installation is linked to an account, sync the gh repos to our db
    await sync_github_repos(team_id=team_id, ctx=request_state.ctx)


async def sync_github_repos(team_id: uuid.UUID, ctx: LogContext) -> None:
    """Create github_repo entries in our DB for each of their repos we have access to through the GitHub API"""
    ctx.eave_team_id = str(team_id)

    response = await QueryGithubRepos.perform(team_id=team_id, origin=EaveApp.eave_api, ctx=ctx)
    repos = response.repos

    async with database.async_session.begin() as db_session:
        # We're grabbing this object fresh from the database so we can update it in this function.
        github_installation_orm = await GithubInstallationOrm.one_or_exception(
            session=db_session,
            team_id=team_id,
        )

        if len(repos) > 0:
            # update the GithubInstallation to set the github_owner_login property to the owner of any repository in the list (we happen to get the first one, but they should all be the same).
            if (owner := repos[0].owner) and owner.login:
                github_installation_orm.github_owner_login = owner.login

        for repo in repos:
            await _create_local_github_repo(
                repo=repo,
                db_session=db_session,
                team_id=team_id,
                github_installation_orm=github_installation_orm,
                ctx=ctx,
            )

    eaveLogger.debug("synced github repos to team", ctx)


async def _create_local_github_repo(
    repo: ExternalGithubRepo,
    db_session: AsyncSession,
    team_id: uuid.UUID,
    github_installation_orm: GithubInstallationOrm,
    ctx: LogContext,
) -> None:
    if repo.id is None:
        eaveLogger.error(
            "Malformed repository object",
            ctx,
        )
        return

    existing_repos = await GithubRepoOrm.query(
        session=db_session,
        params=GithubRepoOrm.QueryParams(
            team_id=team_id,
            external_repo_id=repo.id,
        ),
    )
    assert not len(existing_repos) > 1

    existing_repo = existing_repos[0] if len(existing_repos) == 1 else None

    if existing_repo:
        await eave.stdlib.analytics.log_event(
            event_name="repo_already_added",
            event_description="A repo already existed when attempting to save it to the Eave database",
            event_source="core api github oauth",
            opaque_params={
                "integration_name": Integration.github.value,
                "repo_name": repo.name,
                "repo_id": repo.id,
            },
            ctx=ctx,
        )
    else:
        github_repo_orm = await GithubRepoOrm.create(
            session=db_session,
            team_id=team_id,
            github_installation_id=github_installation_orm.id,
            external_repo_id=repo.id,
            display_name=repo.name,
        )

        # We need to flush the session before running the API docs task, becaused the task depends on the data being available in the database.
        await db_session.flush()

        if github_repo_orm.api_documentation_state == GithubRepoFeatureState.ENABLED:
            await create_task(
                target_path=RunApiDocumentationTask.config.path,
                queue_name=eave.stdlib.config.GITHUB_EVENT_QUEUE_NAME,
                audience=EaveApp.eave_github_app,
                origin=app_config.eave_origin,
                payload=RunApiDocumentationTask.RequestBody(repo=GithubRepoInput(external_repo_id=repo.id)).json(),
                headers={
                    EAVE_TEAM_ID_HEADER: str(team_id),
                    EAVE_REQUEST_ID_HEADER: ctx.eave_request_id,
                },
                ctx=ctx,
            )


def generate_rand_state() -> str:
    state: str = oauthlib.common.generate_token()
    return state
