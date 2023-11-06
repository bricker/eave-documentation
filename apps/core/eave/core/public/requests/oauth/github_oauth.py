import json
from typing import Optional
import urllib.parse
from eave.core.internal.orm.github_installation import GithubInstallationOrm
from eave.core.internal.orm.team import TeamOrm

import eave.pubsub_schemas
from eave.stdlib import utm_cookies
from eave.stdlib.auth_cookies import AuthCookies, get_auth_cookies
import eave.stdlib.cookies
import eave.stdlib.util
import eave.stdlib.analytics
import oauthlib.common
from starlette.requests import Request
from starlette.responses import RedirectResponse, Response

from eave.core.internal import app_config, database
from eave.core.internal.orm import AccountOrm
from eave.stdlib.core_api.models.account import AuthProvider
from eave.stdlib.core_api.models.integrations import Integration
from eave.core.internal.oauth import state_cookies as oauth_cookies
from eave.stdlib.request_state import EaveRequestState

from eave.stdlib.http_endpoint import HTTPEndpoint
from . import EaveOnboardingErrorCode, shared
from eave.stdlib.logging import eaveLogger

_AUTH_PROVIDER = AuthProvider.github


class GithubOAuthAuthorize(HTTPEndpoint):
    """Handles Eave for GitHub app installation requests"""

    async def get(self, request: Request) -> Response:
        # random value for verifying request wasnt tampered with via CSRF
        token: str = oauthlib.common.generate_token()

        # For GitHub, there is a problem: The combined Installation + Authorization flow doesn't allow us
        # to specify a redirect_uri; it chooses the first one configured. So it always redirects to eave.fyi,
        # which makes it practically impossible to test in development (without some proxy configuration).
        # So instead, we're going to set a special cookie and read it on the other side (callback), and redirect if necessary.
        # https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app#generating-a-user-access-token-when-a-user-installs-your-app
        redirect_uri = f"{app_config.eave_public_api_base}/oauth/github/callback"
        state_json = json.dumps({"token": token, "redirect_uri": redirect_uri})
        state = eave.stdlib.util.b64encode(state_json, urlsafe=True)

        authorization_url = f"{app_config.eave_github_app_public_url}/installations/new?state={state}"
        # authorization_url = f"https://github.com/login/oauth/authorize?{qp}"
        response = RedirectResponse(url=authorization_url)

        utm_cookies.set_tracking_cookies(
            response=response,
            request=request,
        )

        oauth_cookies.save_state_cookie(
            response=response,
            state=state,
            provider=_AUTH_PROVIDER,
        )

        return response


class GithubOAuthCallback(HTTPEndpoint):
    auth_provider = _AUTH_PROVIDER
    github_installation_orm: GithubInstallationOrm
    eave_account: Optional[AccountOrm] = None
    eave_team: Optional[TeamOrm] = None

    async def get(
        self,
        request: Request,
    ) -> Response:
        self.response = Response()
        self.eave_state = EaveRequestState.load(request=request)

        if "state" not in request.query_params and "code" not in request.query_params:
            # unable to check validity of data received. or could just be a
            # permissions update from gh website redirecting to our callback
            shared.set_redirect(
                response=self.response,
                location=shared.DEFAULT_REDIRECT_LOCATION,
            )
            return self.response

        if "state" in request.query_params:
            # we set this state in our /oauth/github/authorize endpoint before handing
            # auth over to github
            self.state = state = request.query_params["state"]

            # Because of the GitHub redirect_uri issue described in this file, we need to get the redirect_uri from state,
            # and redirect if it's on a different host.
            # Reminder that in this scenario, the cookies from your local environment won't be available here (because we're probably at eave.fyi)
            state_decoded = json.loads(eave.stdlib.util.b64decode(state, urlsafe=True))
            if redirect_uri := state_decoded.get("redirect_uri"):
                url = urllib.parse.urlparse(redirect_uri)
                if url.hostname != request.url.hostname:
                    qp = urllib.parse.urlencode(request.query_params)
                    location = f"{redirect_uri}?{qp}"
                    return shared.set_redirect(response=self.response, location=location)

            shared.verify_oauth_state_or_exception(
                state=self.state, auth_provider=_AUTH_PROVIDER, request=request, response=self.response
            )

        if "code" in request.query_params:
            # github marketplace installs skip the step where we set state, so manually
            # validate the user (oauth code) has access to the app installation
            installation_id = request.query_params.get("installation_id")
            code = request.query_params.get("code")
            if not installation_id or not code:
                eaveLogger.warning(
                    "Missing GitHub user oauth code and/or app installation_id. Cannot proceed.",
                    self.eave_state.ctx,
                )
                return shared.cancel_flow(response=self.response)

            await shared.verify_stateless_installation_or_exception(code, installation_id, self.eave_state.ctx)

        setup_action = request.query_params.get("setup_action")
        if setup_action not in ["install", "update"]:
            eaveLogger.warning(f"Unexpected github setup_action: {setup_action}", self.eave_state.ctx)

        installation_id = request.query_params.get("installation_id")
        if not installation_id:
            eaveLogger.warning(
                f"github installation_id not provided for action {setup_action}. Cannot proceed.",
                self.eave_state.ctx,
            )
            return shared.cancel_flow(response=self.response)

        self.installation_id = installation_id
        auth_cookies = get_auth_cookies(cookies=request.cookies)

        try:
            await self._maybe_set_account_data(auth_cookies)
            await self._update_or_create_github_installation()
            # dont link github repos to our db until we know what team to associate them w/
            if self._request_logged_in():
                assert self.eave_team  # make types happy
                await shared.sync_github_repos(team_id=self.eave_team.id, ctx=self.eave_state.ctx)
        except Exception as e:
            if shared.is_error_response(self.response):
                return self.response
            raise e

        return self.response

    async def _maybe_set_account_data(self, auth_cookies: AuthCookies) -> None:
        if not auth_cookies.all_set:
            # This is the case where they're going through the install flow but not logged in.
            # (e.g. installing from github marketplace w/o an Eave account)
            shared.set_redirect(
                response=self.response,
                location=shared.SIGNUP_REDIRECT_LOCATION,
            )
        else:
            async with database.async_session.begin() as db_session:
                eave_account = await AccountOrm.one_or_none(
                    session=db_session,
                    params=AccountOrm.QueryParams(
                        id=eave.stdlib.util.ensure_uuid(auth_cookies.account_id), access_token=auth_cookies.access_token
                    ),
                )

                if not eave_account:
                    shared.cancel_flow(response=self.response)
                    raise Exception("auth_cookies did not point to valid account")

                self.eave_account = eave_account
                self.eave_team = await self.eave_account.get_team(session=db_session)

            shared.set_redirect(
                response=self.response,
                location=shared.DEFAULT_REDIRECT_LOCATION,
            )

    async def _update_or_create_github_installation(
        self,
    ) -> None:
        async with database.async_session.begin() as db_session:
            # try fetch existing github installation
            github_installation_orm = await GithubInstallationOrm.query(
                session=db_session,
                params=GithubInstallationOrm.QueryParams(
                    team_id=self.eave_team.id if self.eave_team else None,
                    github_install_id=self.installation_id,
                ),
            )

            if not github_installation_orm:
                # create state cookie we can use later to associate new accounts
                # with a dangling app installation row
                state = None

                # only set state cookie for installations that wont have a team_id set
                if not self._request_logged_in():
                    state = shared.generate_and_set_state_cookie(
                        response=self.response, installation_id=self.installation_id
                    )

                # create new github installation associated with the TeamOrm
                # (or create a dangling installation to later associate w/ a future account)
                github_installation_orm = await GithubInstallationOrm.create(
                    session=db_session,
                    team_id=self.eave_account.team_id if self.eave_account else None,
                    github_install_id=self.installation_id,
                    install_flow_state=state,
                )

                if self._request_logged_in():
                    await eave.stdlib.analytics.log_event(
                        event_name="eave_application_integration",
                        event_description="An integration was added for a team",
                        event_source="core api github app install",
                        eave_account=self.eave_account.analytics_model if self.eave_account else None,
                        eave_team=self.eave_team.analytics_model if self.eave_team else None,
                        opaque_params={
                            "integration_name": Integration.github.value,
                        },
                        ctx=self.eave_state.ctx,
                    )
                else:
                    await eave.stdlib.analytics.log_event(
                        event_name="eave_application_registered",
                        event_description="An app was registered, but has no linked team",
                        event_source="core api github app install",
                        opaque_params={
                            "integration_name": Integration.github.value,
                            "installation_id": self.installation_id,
                        },
                        ctx=self.eave_state.ctx,
                    )

            elif self.eave_account and github_installation_orm.team_id != self.eave_account.team_id:
                eaveLogger.warning(
                    f"A Github integration already exists with github install id {self.installation_id}",
                    self.eave_state.ctx,
                )
                await eave.stdlib.analytics.log_event(
                    event_name="duplicate_integration_attempt",
                    event_source="core api github oauth",
                    eave_account=self.eave_account.analytics_model,
                    eave_team=self.eave_team.analytics_model if self.eave_team else None,
                    opaque_params={"integration": Integration.github},
                    ctx=self.eave_state.ctx,
                )
                shared.set_error_code(response=self.response, error_code=EaveOnboardingErrorCode.already_linked)
                raise Exception("Attempted to link Github integration when one already existed")
            else:
                await eave.stdlib.analytics.log_event(
                    event_name="eave_application_integration_updated",
                    event_description="An integration was re-installed or updated for a team",
                    event_source="core api github oauth",
                    eave_account=self.eave_account.analytics_model if self.eave_account else None,
                    eave_team=self.eave_team.analytics_model if self.eave_team else None,
                    opaque_params={
                        "integration_name": Integration.github.value,
                    },
                    ctx=self.eave_state.ctx,
                )

            self.github_installation_orm = github_installation_orm

    def _request_logged_in(self) -> bool:
        return self.eave_team is not None and self.eave_account is not None
