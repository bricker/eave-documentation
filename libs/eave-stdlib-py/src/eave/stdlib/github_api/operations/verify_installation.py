from typing import Unpack
from eave.stdlib import requests
from eave.stdlib.core_api.operations import BaseRequestBody, BaseResponseBody
from eave.stdlib.github_api.operations import GithubAppEndpoint, GithubAppEndpointConfiguration


class VerifyInstallation(GithubAppEndpoint):
    config = GithubAppEndpointConfiguration(
        path="/github/api/verify",
        auth_required=False,
        team_id_required=False,
    )

    class RequestBody(BaseRequestBody):
        code: str
        installation_id: str

    class ResponseBody(BaseResponseBody):
        pass

    @classmethod
    async def perform(cls, input: RequestBody, **kwargs: Unpack[requests.CommonRequestArgs]) -> ResponseBody:
        response = await requests.make_request(
            config=cls.config,
            input=input,
            **kwargs,
        )

        body = await cls.make_response(response, cls.ResponseBody)
        return body
