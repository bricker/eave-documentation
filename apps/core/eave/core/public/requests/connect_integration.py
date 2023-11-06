import http

import eave.core.internal.database as eave_db
import eave.core.internal.orm as eave_orm
from eave.core.internal.orm.connect_installation import ConnectInstallationOrm
from eave.core.internal.orm.team import TeamOrm
from eave.stdlib.http_endpoint import HTTPEndpoint
from eave.stdlib.core_api.operations.connect import QueryConnectIntegrationRequest, RegisterConnectIntegrationRequest
from eave.stdlib.logging import eaveLogger

from eave.stdlib import analytics
import eave.stdlib.api_util as eave_api_util
from starlette.requests import Request
from starlette.responses import Response

from eave.stdlib.request_state import EaveRequestState


class QueryConnectIntegrationEndpoint(HTTPEndpoint):
    async def post(self, request: Request) -> Response:
        eave_state = EaveRequestState.load(request=request)
        body = await request.json()
        input = QueryConnectIntegrationRequest.RequestBody.parse_obj(body)

        async with eave_db.async_session.begin() as db_session:
            installation = await ConnectInstallationOrm.one_or_none(
                session=db_session,
                product=input.connect_integration.product,
                client_key=input.connect_integration.client_key,
                team_id=input.connect_integration.team_id,
            )

            if not installation:
                eaveLogger.warning(
                    f"{input.connect_integration.product} Integration not found",
                    eave_state.ctx,
                )
                return Response(status_code=http.HTTPStatus.NOT_FOUND)

            if installation.team_id:
                eave_team = await eave_orm.TeamOrm.one_or_exception(
                    session=db_session,
                    team_id=installation.team_id,
                )
            else:
                eave_team = None

        return eave_api_util.json_response(
            QueryConnectIntegrationRequest.ResponseBody(
                team=eave_team.api_model if eave_team else None,
                connect_integration=installation.api_model,
            )
        )


class RegisterConnectIntegrationEndpoint(HTTPEndpoint):
    """
    Creates or update a Connect integration.
    If the given client_key already exists, this endpoint updates the existing integration.
    If it doesn't exist, it creates a new integration.
    The client_key is unique and will never change.
    https://developer.atlassian.com/cloud/confluence/connect-app-descriptor/#lifecycle
    """

    async def post(self, request: Request) -> Response:
        eave_state = EaveRequestState.load(request=request)
        body = await request.json()
        input = RegisterConnectIntegrationRequest.RequestBody.parse_obj(body)

        eave_team = None

        async with eave_db.async_session.begin() as db_session:
            integration = await ConnectInstallationOrm.one_or_none(
                session=db_session,
                product=input.connect_integration.product,
                client_key=input.connect_integration.client_key,
            )

            if not integration:
                """
                If the baseUrl exists with a different client key, Atlassian suggests updating that record with the new
                client key as a workaround, but it also says that baseUrl isn't unique and shouldn't be used as an identifier. So
                I'll lean cautious here and ignore that case.
                https://developer.atlassian.com/cloud/confluence/connect-app-descriptor/#lifecycle-attribute-example
                https://ecosystem.atlassian.net/browse/AC-1528
                """

                # First, check if another Connect installation exists with this base URL.
                # If so, then we can grab the team ID.

                other_connect_integration = await ConnectInstallationOrm.one_or_none(
                    session=db_session,
                    org_url=ConnectInstallationOrm.make_org_url(input.connect_integration.base_url),
                )

                if other_connect_integration and other_connect_integration.team_id:
                    eave_team = await TeamOrm.one_or_exception(
                        session=db_session, team_id=other_connect_integration.team_id
                    )

                integration = await ConnectInstallationOrm.create(
                    session=db_session,
                    client_key=input.connect_integration.client_key,
                    product=input.connect_integration.product,
                    base_url=input.connect_integration.base_url,
                    shared_secret=input.connect_integration.shared_secret,
                    atlassian_actor_account_id=input.connect_integration.atlassian_actor_account_id,
                    display_url=input.connect_integration.display_url,
                    description=input.connect_integration.description,
                    team_id=eave_team.id if eave_team else None,
                )

                if eave_team:
                    await analytics.log_event(
                        event_name="eave_application_integration",
                        event_description="An integration was added for a team",
                        event_source="register connect integration endpoint",
                        eave_team=eave_team.analytics_model,
                        opaque_params={
                            "integration_name": integration.product,
                            "atlassian_org_url": integration.org_url,
                            "atlassian_site_description": integration.description,
                            "atlassian_actor_account_id": integration.atlassian_actor_account_id,
                        },
                        ctx=eave_state.ctx,
                    )
                else:
                    await analytics.log_event(
                        event_name="eave_application_registered",
                        event_description="An app was registered, but has no linked team",
                        event_source="register connect integration endpoint",
                        opaque_params={
                            "integration_name": integration.product,
                            "atlassian_org_url": integration.org_url,
                            "atlassian_site_description": integration.description,
                            "atlassian_actor_account_id": integration.atlassian_actor_account_id,
                        },
                        ctx=eave_state.ctx,
                    )

            else:
                integration.update(
                    session=db_session,
                    input=input.connect_integration,
                )

                if integration.team_id:
                    eave_team = await TeamOrm.one_or_exception(session=db_session, team_id=integration.team_id)

                await analytics.log_event(
                    event_name="eave_application_integration_updated",
                    event_description="An integration was updated for a team",
                    event_source="register connect integration endpoint",
                    eave_team=eave_team.analytics_model if eave_team else None,
                    opaque_params={
                        "integration_name": integration.product,
                        "atlassian_org_url": integration.org_url,
                        "atlassian_site_description": integration.description,
                        "atlassian_actor_account_id": integration.atlassian_actor_account_id,
                    },
                    ctx=eave_state.ctx,
                )

        return eave_api_util.json_response(
            RegisterConnectIntegrationRequest.ResponseBody(
                team=eave_team.api_model if eave_team else None,
                connect_integration=integration.api_model,
            )
        )
