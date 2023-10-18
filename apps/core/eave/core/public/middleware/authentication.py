from http import HTTPStatus
from typing import cast
from eave.core.internal.orm.account import AccountOrm
from eave.stdlib.auth_cookies import delete_auth_cookies, set_auth_cookies
from eave.stdlib.core_api.operations import EndpointConfiguration

import eave.stdlib.headers
import eave.stdlib.api_util
import eave.stdlib.exceptions
import eave.core.internal
import eave.core.public
from eave.stdlib.logging import LogContext, eaveLogger
from asgiref.typing import ASGI3Application, ASGIReceiveCallable, ASGISendCallable, ASGISendEvent, Scope
from eave.stdlib.api_util import get_bearer_token
from starlette.responses import Response
from starlette.datastructures import MutableHeaders
import starlette.types
from eave.stdlib.request_state import EaveRequestState
from eave.stdlib.middleware.development_bypass import development_bypass_allowed
from eave.stdlib.util import ensure_uuid
from .development_bypass import development_bypass_auth
from eave.stdlib.middleware.base import EaveASGIMiddleware
from eave.stdlib.exceptions import UnauthorizedError


class AuthASGIMiddleware(EaveASGIMiddleware):
    endpoint_config: EndpointConfiguration

    def __init__(self, app: ASGI3Application, endpoint_config: EndpointConfiguration) -> None:
        super().__init__(app)
        self.endpoint_config = endpoint_config

    async def __call__(self, scope: Scope, receive: ASGIReceiveCallable, send: ASGISendCallable) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        if development_bypass_allowed(scope=scope):
            try:
                await development_bypass_auth(scope=scope)
            except Exception:
                if self.endpoint_config.auth_required:
                    raise

            await self.app(scope, receive, send)
            return

        eave_state = EaveRequestState.load(scope=scope)
        account_id_header = eave.stdlib.api_util.get_header_value(
            scope=scope, name=eave.stdlib.headers.EAVE_ACCOUNT_ID_HEADER
        )

        access_token = get_bearer_token(scope=scope)

        try:
            if account_id_header is None or access_token is None:
                if not self.endpoint_config.auth_required:
                    await self.app(scope, receive, send)
                    return
                else:
                    raise UnauthorizedError("missing auth headers")

            account = await self._verify_auth(
                account_id_header=account_id_header, access_token=access_token, ctx=eave_state.ctx
            )
            eave_state.ctx.eave_account_id = str(account.id)
            eave_state.ctx.eave_team_id = str(account.team_id)

        except UnauthorizedError as e:
            eaveLogger.exception(e, eave_state.ctx)
            await self._abort_unauthorized(scope, receive, send)
            return

        async def _send(event: ASGISendEvent) -> None:
            if event["type"] != "http.response.start":
                await send(event)
                return

            headers = MutableHeaders(raw=list(event["headers"]))
            response = Response(headers=headers)
            set_auth_cookies(
                response=response,
                team_id=account.team_id,
                account_id=account.id,
                access_token=account.access_token,
            )

            event["headers"] = response.headers.raw
            await send(event)

        await self.app(scope, receive, _send)

    async def _verify_auth(self, account_id_header: str, access_token: str, ctx: LogContext) -> AccountOrm:
        async with eave.core.internal.database.async_session.begin() as db_session:
            eave_account = await AccountOrm.one_or_none(
                session=db_session,
                params=AccountOrm.QueryParams(
                    id=ensure_uuid(account_id_header),
                    access_token=access_token,
                ),
            )

            if not eave_account:
                raise UnauthorizedError("invalid auth")

            try:
                await eave_account.verify_oauth_or_exception(session=db_session, ctx=ctx)
            except eave.stdlib.exceptions.AccessTokenExpiredError:
                await eave_account.refresh_oauth_token(session=db_session, ctx=ctx)
                await eave_account.verify_oauth_or_exception(session=db_session, ctx=ctx)

        return eave_account

    async def _abort_unauthorized(self, scope: Scope, receive: ASGIReceiveCallable, send: ASGISendCallable) -> None:
        response = Response(status_code=HTTPStatus.UNAUTHORIZED)
        delete_auth_cookies(response=response)
        await response(
            cast(starlette.types.Scope, scope), cast(starlette.types.Receive, receive), cast(starlette.types.Send, send)
        )