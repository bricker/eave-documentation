import http.cookies
import typing
from datetime import datetime
from typing import Any, Literal, Optional, Protocol


from .config import shared_config


class ResponseCookieMutator(Protocol):
    """
    This protocol is necessary because we pass in both Flask and Starlette response objects, which both
    have the same set_cookie signature but are different types.
    """

    # Copied from Starlette's set_cookie signature
    def set_cookie(
        self,
        key: str,
        value: str = "",
        max_age: typing.Optional[int] = None,
        expires: typing.Optional[typing.Union[datetime, str, int]] = None,
        path: str = "/",
        domain: typing.Optional[str] = None,
        secure: bool = False,
        httponly: bool = False,
        samesite: typing.Optional[Literal["lax", "strict", "none"]] = "lax",
    ) -> Any:
        ...

def http_cookie(
    key: str,
    value: str,
    max_age: Optional[int] = None,
    expires: Optional[int] = None,
    httponly: bool = True
) -> str:
    cookie = http.cookies.SimpleCookie()
    cookie[key] = value

    if max_age is not None:
        cookie[key]["max-age"] = max_age
    if expires is not None:
        cookie[key]["expires"] = expires

    cookie[key]["domain"] = shared_config.eave_cookie_domain

    if not shared_config.is_development:
        cookie[key]["secure"] = True

    if httponly:
        cookie[key]["httponly"] = True

    cookie_val = cookie.output(header="").strip()
    return cookie_val

def set_http_cookie(key: str, value: str, response: ResponseCookieMutator, httponly: bool = True) -> None:
    response.set_cookie(
        key=key,
        value=value,
        max_age=(60 * 60 * 24 * 365),
        domain=shared_config.eave_cookie_domain,
        httponly=httponly,
        secure=(not shared_config.is_development),
    )


def delete_http_cookie(response: ResponseCookieMutator, key: str, httponly: bool = True) -> None:
    response.set_cookie(
        key=key,
        value="",
        max_age=0,
        expires=0,
        domain=shared_config.eave_cookie_domain,
        httponly=httponly,
        secure=(not shared_config.is_development),
    )
