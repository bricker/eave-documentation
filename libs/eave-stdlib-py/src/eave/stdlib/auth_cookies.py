from dataclasses import dataclass
from typing import Mapping, Optional
import uuid

import aiohttp

from eave.stdlib.cookies import ResponseCookieMutator, delete_http_cookie, http_cookie, set_http_cookie

_EAVE_ACCOUNT_ID_COOKIE = "ev_account_id"
_EAVE_TEAM_ID_COOKIE = "ev_team_id"
_EAVE_ACCESS_TOKEN_COOKIE = "ev_access_token"


@dataclass
class AuthCookies:
    account_id: Optional[str]
    team_id: Optional[str]
    access_token: Optional[str]

def forward_response_auth_cookies(
    from_server: aiohttp.ClientResponse,
    to_client: ResponseCookieMutator,
) -> None:

    _forward_response_auth_cookie(key=_EAVE_ACCOUNT_ID_COOKIE, from_server=from_server, to_client=to_client)
    _forward_response_auth_cookie(key=_EAVE_ACCESS_TOKEN_COOKIE, from_server=from_server, to_client=to_client)
    _forward_response_auth_cookie(key=_EAVE_ACCESS_TOKEN_COOKIE, from_server=from_server, to_client=to_client)

def _forward_response_auth_cookie(
    key: str,
    from_server: aiohttp.ClientResponse,
    to_client: ResponseCookieMutator,
) -> None:
    if m := from_server.cookies.get(key):
        if m.value:
            set_http_cookie(key=key, value=m.value, response=to_client)
        else:
            delete_http_cookie(key=key, response=to_client)

def auth_cookies(
    response: ResponseCookieMutator,
    account_id: Optional[uuid.UUID | str],
    team_id: Optional[uuid.UUID | str],
    access_token: Optional[str],
) -> list[str]:
    cookie_vals: list[str] = []

    if account_id:
        v = set_http_cookie()
        cookie_vals.append
        set_http_cookie(key=_EAVE_ACCOUNT_ID_COOKIE, value=str(account_id), response=response)
    else:
        delete_http_cookie(response=response, key=_EAVE_ACCOUNT_ID_COOKIE)

    if team_id:
        set_http_cookie(key=_EAVE_TEAM_ID_COOKIE, value=str(team_id), response=response)
    else:
        delete_http_cookie(response=response, key=_EAVE_TEAM_ID_COOKIE)

    if access_token:
        set_http_cookie(key=_EAVE_ACCESS_TOKEN_COOKIE, value=access_token, response=response)
    else:
        delete_http_cookie(response=response, key=_EAVE_ACCESS_TOKEN_COOKIE)

def set_auth_cookies(
    response: ResponseCookieMutator,
    account_id: Optional[uuid.UUID | str],
    team_id: Optional[uuid.UUID | str],
    access_token: Optional[str],
) -> None:
    if account_id:
        set_http_cookie(key=_EAVE_ACCOUNT_ID_COOKIE, value=str(account_id), response=response)
    else:
        delete_http_cookie(response=response, key=_EAVE_ACCOUNT_ID_COOKIE)

    if team_id:
        set_http_cookie(key=_EAVE_TEAM_ID_COOKIE, value=str(team_id), response=response)
    else:
        delete_http_cookie(response=response, key=_EAVE_TEAM_ID_COOKIE)

    if access_token:
        set_http_cookie(key=_EAVE_ACCESS_TOKEN_COOKIE, value=access_token, response=response)
    else:
        delete_http_cookie(response=response, key=_EAVE_ACCESS_TOKEN_COOKIE)

def get_auth_cookies(cookies: Mapping[str, str]) -> AuthCookies:
    account_id = cookies.get(_EAVE_ACCOUNT_ID_COOKIE)
    team_id = cookies.get(_EAVE_TEAM_ID_COOKIE)
    access_token = cookies.get(_EAVE_ACCESS_TOKEN_COOKIE)

    return AuthCookies(
        account_id=account_id,
        team_id=team_id,
        access_token=access_token,
    )


def delete_auth_cookies(response: ResponseCookieMutator) -> None:
    set_auth_cookies(
        response=response,
        account_id=None,
        team_id=None,
        access_token=None,
    )
