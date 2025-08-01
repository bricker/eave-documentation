import typing
from dataclasses import dataclass
from functools import cache
from typing import cast
from eave.stdlib.config import SHARED_CONFIG

import eave.stdlib.typing
import eave.stdlib.atlassian
import requests_oauthlib
from oauthlib.oauth2 import OAuth2Token
from eave.stdlib.atlassian import ConfluenceUser

from eave.stdlib.exceptions import ConfluenceDataError

from .models import OAuthFlowInfo


@dataclass
class AtlassianOAuthTokenResponse:
    access_token: str
    expires_in: int
    scope: str


ATLASSIAN_OAUTH_SCOPES = [
    "read:confluence-user",
    "read:me",
    "read:account",
    "offline_access",
]

ATLASSIAN_OAUTH_AUTHORIZE_PATH = "/oauth/atlassian/authorize"
ATLASSIAN_OAUTH_CALLBACK_PATH = "/oauth/atlassian/callback"
ATLASSIAN_OAUTH_CALLBACK_URI = f"{SHARED_CONFIG.eave_public_api_base}{ATLASSIAN_OAUTH_CALLBACK_PATH}"


class AtlassianOAuthSession(requests_oauthlib.OAuth2Session):
    def __init__(self, client=None, token=None, state=None, token_updater=None, **kwargs):  # type: ignore[no-untyped-def]
        client_id = SHARED_CONFIG.eave_atlassian_app_client_id
        client_secret = SHARED_CONFIG.eave_atlassian_app_client_secret

        super().__init__(
            client_id=client_id,
            redirect_uri=ATLASSIAN_OAUTH_CALLBACK_URI,
            scope=" ".join(ATLASSIAN_OAUTH_SCOPES),
            client=client,
            auto_refresh_url="https://auth.atlassian.com/oauth/token",
            auto_refresh_kwargs={
                "client_id": client_id,
                "client_secret": client_secret,
            },
            token=token,
            state=state,
            token_updater=token_updater,
            **kwargs,
        )

    def authorization_url(self, state=None, **kwargs):  # type: ignore[no-untyped-def]
        return super().authorization_url(
            url="https://auth.atlassian.com/authorize",
            state=state,
            audience="api.atlassian.com",
            prompt="consent",
            **kwargs,
        )

    def fetch_token(self, code=None, authorization_response=None, body="", auth=None, username=None, password=None, method="POST", force_querystring=False, timeout=None, headers=None, verify=True, proxies=None, include_client_id=None, cert=None, **kwargs):  # type: ignore[no-untyped-def]
        return super().fetch_token(
            token_url="https://auth.atlassian.com/oauth/token",
            client_secret=SHARED_CONFIG.eave_atlassian_app_client_secret,
            code=code,
            authorization_response=authorization_response,
            body=body,
            auth=auth,
            username=username,
            password=password,
            method=method,
            force_querystring=force_querystring,
            timeout=timeout,
            headers=headers,
            verify=verify,
            proxies=proxies,
            include_client_id=include_client_id,
            cert=cert,
            **kwargs,
        )

    def request(self, method, url, data=None, headers=None, withhold_token=False, client_id=None, client_secret=None, **kwargs):  # type: ignore[no-untyped-def]
        return super().request(method, url, data, headers, withhold_token, client_id, client_secret, **kwargs)

    def oauth_flow_info(self) -> OAuthFlowInfo:
        authorization_url, state = self.authorization_url()

        authorization_url = cast(str, authorization_url)
        state = cast(str, state)
        return OAuthFlowInfo(authorization_url=authorization_url, state=state)

    @cache
    def get_available_resources(self) -> list[eave.stdlib.atlassian.AtlassianAvailableResource]:
        available_resources_response = self.request(
            method="GET",
            url="https://api.atlassian.com/oauth/token/accessible-resources",
        )
        available_resources_data: list[eave.stdlib.typing.JsonObject] = available_resources_response.json()
        available_resources = [eave.stdlib.atlassian.AtlassianAvailableResource(j) for j in available_resources_data]
        return available_resources

    def get_userinfo(self) -> ConfluenceUser:
        response = self.request(
            method="GET",
            url=f"{self.api_base_url}/rest/api/user/current",
        )

        userinfo = ConfluenceUser(response.json())
        return userinfo

    @property
    def atlassian_cloud_id(self) -> str:
        available_resources = self.get_available_resources()
        if len(available_resources) == 0:
            raise ConfluenceDataError("atlassian available resources")

        id = available_resources[0].id
        if id is None:
            raise ConfluenceDataError("missing atlassian_cloud_id")

        return id

    @property
    def api_base_url(self) -> str:
        return f"https://api.atlassian.com/ex/confluence/{self.atlassian_cloud_id}"

    def get_token(self) -> OAuth2Token:
        """This is mostly for tests"""
        return typing.cast(OAuth2Token, self.token)
