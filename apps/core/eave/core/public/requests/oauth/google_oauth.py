from typing import cast
from eave.stdlib import analytics, utm_cookies
from eave.stdlib.core_api.models.account import AuthProvider

import google.oauth2.credentials
import google.oauth2.id_token
from starlette.requests import Request
from starlette.responses import RedirectResponse, Response

import eave.core.internal.oauth.google
from eave.core.internal.oauth import state_cookies as oauth_cookies
from eave.stdlib.exceptions import MissingOAuthCredentialsError

from eave.stdlib.http_endpoint import HTTPEndpoint
from eave.stdlib.logging import LogContext
from . import base, shared

_AUTH_PROVIDER = AuthProvider.google


class GoogleOAuthAuthorize(HTTPEndpoint):
    async def get(self, request: Request) -> Response:
        ctx = LogContext.wrap(scope=request.scope)

        await analytics.log_event(
            event_name="oauth_flow_started",
            event_description="A user started the Oauth flow (login/register)",
            event_source="google oauth authorize endpoint",
            opaque_params={
                "auth_provider": _AUTH_PROVIDER,
            },
            ctx=ctx,
        )

        oauth_flow_info = eave.core.internal.oauth.google.get_oauth_flow_info()
        response = RedirectResponse(url=oauth_flow_info.authorization_url)

        utm_cookies.set_tracking_cookies(
            response=response,
            request=request,
        )

        oauth_cookies.save_state_cookie(
            response=response,
            state=oauth_flow_info.state,
            provider=_AUTH_PROVIDER,
        )

        return response


class GoogleOAuthCallback(base.BaseOAuthCallback):
    auth_provider = _AUTH_PROVIDER

    async def get(self, request: Request) -> Response:
        await super().get(request=request)
        ctx = LogContext.wrap(scope=request.scope)

        if not self._check_valid_callback():
            return self.response

        await analytics.log_event(
            event_name="oauth_flow_completed",
            event_description="A user completed the Oauth flow (login/register)",
            event_source="google oauth authorize endpoint",
            opaque_params={
                "auth_provider": _AUTH_PROVIDER,
            },
            ctx=ctx,
        )

        flow = eave.core.internal.oauth.google.build_flow(state=self.state)
        flow.fetch_token(code=self.code)

        # flow.credentials returns a `google.auth.credentials.Credentials`, which is the base class of
        # google.oauth2.credentials.Credentials and doesn't contain common oauth properties like refresh_token.
        # The `cast` here gives us type hints, autocomplete, etc. for `flow.credentials`
        credentials = cast(google.oauth2.credentials.Credentials, flow.credentials)
        if credentials.id_token is None:
            raise MissingOAuthCredentialsError("google oauth2 credentials")

        google_token = eave.core.internal.oauth.google.decode_id_token(id_token=credentials.id_token)
        eave_team_name = f"{google_token.given_name}'s Team" if google_token.given_name else "Your Team"

        account = await shared.get_or_create_eave_account(
            request=self.request,
            response=self.response,
            eave_team_name=eave_team_name,
            user_email=google_token.email,
            auth_provider=self.auth_provider,
            auth_id=google_token.sub,
            access_token=credentials.token,
            refresh_token=credentials.refresh_token,
        )

        await shared.try_associate_account_with_dangling_github_installation(
            request=self.request, response=self.response, team_id=account.team_id
        )

        return self.response
