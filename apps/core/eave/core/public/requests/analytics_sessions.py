from http import HTTPStatus

import eave.stdlib.api_util
from eave.stdlib.core_api.operations.analytics_sessions import CreateAnalyticsSessionRequest
import eave.stdlib.util
import eave.core.internal
import eave.core.public
from starlette.requests import Request
from starlette.responses import Response
from eave.stdlib.request_state import EaveRequestState
from eave.core.internal.orm.analytics_session import AnalyticsSessionOrm

class CreateAnalyticsSession(eave.core.public.http_endpoint.HTTPEndpoint):
    async def post(self, request: Request) -> Response:
        body = await request.json()
        input = CreateAnalyticsSessionRequest.RequestBody.parse_obj(body)

        async with eave.core.internal.database.async_session.begin() as db_session:
            if input.analytics_session.account_id is not None:
                account = await eave.core.internal.orm.AccountOrm.one_or_exception(
                    session=db_session, id=eave.stdlib.util.unwrap(input.analytics_session.account_id)
                )

            analytics_session = await AnalyticsSessionOrm.create(
                session=db_session,
                visitor_id=input.analytics_session.visitor_id,
                account_id=input.analytics_session.account_id,
            )
            status_code = HTTPStatus.CREATED

        return eave.stdlib.api_util.json_response(
            model=CreateAnalyticsSessionRequest.ResponseBody(
                analytics_session=analytics_session.api_model,
            ),
            status_code=status_code,
        )
