from typing import Optional, Unpack
import uuid
from eave.stdlib.core_api.models.github import GithubInstallation
from eave.stdlib.core_api.models.github import GithubInstallationInput
from . import BaseRequestBody, BaseResponseBody, CoreApiEndpoint, CoreApiEndpointConfiguration

from ..models import team
from ... import requests


class GetGithubInstallation(CoreApiEndpoint):
    config = CoreApiEndpointConfiguration(
        path="/integrations/github/query",
        auth_required=False,
        team_id_required=False,
    )

    class RequestBody(BaseRequestBody):
        github_integration: GithubInstallationInput

    class ResponseBody(BaseResponseBody):
        team: Optional[team.Team]
        github_integration: GithubInstallation

    @classmethod
    async def perform(
        cls,
        input: RequestBody,
        **kwargs: Unpack[requests.CommonRequestArgs],
    ) -> ResponseBody:
        response = await requests.make_request(
            config=cls.config,
            input=input,
            **kwargs,
        )

        body = await cls.make_response(response, cls.ResponseBody)
        return body


class DeleteGithubInstallation(CoreApiEndpoint):
    config = CoreApiEndpointConfiguration(
        path="/integrations/github/delete",
        auth_required=False,
    )

    class RequestBody(BaseRequestBody):
        github_integration: GithubInstallationInput

    class ResponseBody(BaseResponseBody):
        pass

    @classmethod
    async def perform(
        cls,
        input: RequestBody,
        team_id: uuid.UUID,
        **kwargs: Unpack[requests.CommonRequestArgs],
    ) -> ResponseBody:
        response = await requests.make_request(
            config=cls.config,
            input=input,
            team_id=team_id,
            **kwargs,
        )

        body = await cls.make_response(response, cls.ResponseBody)
        return body
