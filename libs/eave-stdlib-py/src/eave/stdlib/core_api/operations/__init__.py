import aiohttp
from typing import Optional, TypeVar, Type
import pydantic
from eave.stdlib.eave_origins import EaveApp
from ...config import shared_config

_base_url = shared_config.eave_internal_service_base(EaveApp.eave_api)


class EndpointConfiguration:
    path: str
    method: str
    audience: EaveApp
    auth_required: bool
    team_id_required: bool
    signature_required: bool
    origin_required: bool

    def __init__(
        self,
        path: str,
        method: str = "POST",
        auth_required: bool = True,
        team_id_required: bool = True,
        signature_required: bool = True,
        origin_required: bool = True,
    ) -> None:
        self.path = path
        self.method = method
        self.auth_required = auth_required
        self.team_id_required = team_id_required
        self.signature_required = signature_required
        self.origin_required = origin_required

    @property
    def url(self) -> str:
        return f"{_base_url}{self.path}"


class CoreApiEndpointConfiguration(EndpointConfiguration):
    audience = EaveApp.eave_api


class BaseRequestBody(pydantic.BaseModel):
    pass


class BaseResponseBody(pydantic.BaseModel):
    _raw_response: Optional[aiohttp.ClientResponse] = None

    class Config:
        underscore_attrs_are_private = True

    @property
    def cookies(self) -> dict[str, str] | None:
        if self._raw_response:
            # SimpleCookie is a dict but invariant with dict[str,str], so convert it here
            return {k: v.value for k, v in self._raw_response.cookies.items()}
        else:
            return None


T = TypeVar("T", bound=BaseResponseBody)


class Endpoint:
    config: EndpointConfiguration

    @classmethod
    async def make_response(cls, response: aiohttp.ClientResponse, response_type: Type[T]) -> T:
        response_json = await response.json()
        if response_json:
            r = response_type(**response_json)
        else:
            r = response_type()
        r._raw_response = response
        return r


class CoreApiEndpoint(Endpoint):
    config: CoreApiEndpointConfiguration
