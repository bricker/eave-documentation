from http import HTTPStatus
from starlette.requests import Request
from starlette.responses import Response

import eave.core.internal.database as eave_db
import eave.core.internal.orm as eave_orm
from eave.stdlib.http_endpoint import HTTPEndpoint
import eave.stdlib.api_util as eave_api_util
from eave.stdlib.core_api.operations.github import GetGithubInstallation, DeleteGithubInstallation
from eave.stdlib.exceptions import NotFoundError
from eave.stdlib.request_state import EaveRequestState
from eave.stdlib.util import ensure_uuid, ensure_uuid_or_none


class GetGithubIntegrationEndpoint(HTTPEndpoint):
    async def post(self, request: Request) -> Response:
        eave_state = EaveRequestState.load(request=request)
        eave_team_id = eave_state.ctx.eave_team_id

        body = await request.json()
        input = GetGithubInstallation.RequestBody.parse_obj(body)

        async with eave_db.async_session.begin() as db_session:
            installation = await eave_orm.GithubInstallationOrm.query(
                session=db_session,
                params=eave_orm.GithubInstallationOrm.QueryParams(
                    team_id=ensure_uuid_or_none(eave_team_id),
                    github_install_id=input.github_integration.github_install_id,
                ),
            )

            if not installation:
                raise NotFoundError()

            if not installation.team_id:
                eave_team = None
            else:
                eave_team = await eave_orm.TeamOrm.one_or_exception(
                    session=db_session,
                    team_id=installation.team_id,
                )

        return eave_api_util.json_response(
            GetGithubInstallation.ResponseBody(
                github_integration=installation.api_model,
                team=eave_team.api_model if eave_team else None,
            )
        )


class DeleteGithubIntegrationEndpoint(HTTPEndpoint):
    async def post(self, request: Request) -> Response:
        eave_state = EaveRequestState.load(request=request)
        body = await request.json()
        input = DeleteGithubInstallation.RequestBody.parse_obj(body)

        async with eave_db.async_session.begin() as db_session:
            await eave_orm.GithubInstallationOrm.delete_by_github_install_id(
                session=db_session,
                team_id=ensure_uuid(eave_state.ctx.eave_team_id),
                github_install_id=input.github_integration.github_install_id,
            )

        return Response(status_code=HTTPStatus.OK)
