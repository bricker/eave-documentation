from typing import Unpack, Optional
import uuid
from ... import requests
from eave.stdlib.core_api.models.github_repos import (
    GithubRepo,
    GithubRepoCreateInput,
    GithubRepoListInput,
    GithubReposDeleteInput,
    GithubRepoUpdateInput,
    GithubReposFeatureStateInput,
)
from . import BaseRequestBody, BaseResponseBody, CoreApiEndpoint, CoreApiEndpointConfiguration


class GetGithubReposRequest(CoreApiEndpoint):
    config = CoreApiEndpointConfiguration(
        path="/github-repos/query",
        auth_required=False,
    )

    class RequestBody(BaseRequestBody):
        repos: Optional[list[GithubRepoListInput]] = None

    class ResponseBody(BaseResponseBody):
        repos: list[GithubRepo]

    @classmethod
    async def perform(
        cls,
        input: RequestBody,
        team_id: uuid.UUID | str,
        account_id: Optional[uuid.UUID],
        access_token: Optional[str],
        **kwargs: Unpack[requests.CommonRequestArgs],
    ) -> ResponseBody:
        response = await requests.make_request(
            config=cls.config,
            input=input,
            team_id=team_id,
            account_id=account_id,
            access_token=access_token,
            **kwargs,
        )

        body = await cls.make_response(response, cls.ResponseBody)
        return body


class GetAllTeamsGithubReposRequest(CoreApiEndpoint):
    config = CoreApiEndpointConfiguration(path="/_/github-repos/query", auth_required=False, team_id_required=False)

    class RequestBody(BaseRequestBody):
        query_params: GithubReposFeatureStateInput

    class ResponseBody(BaseResponseBody):
        repos: list[GithubRepo]

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


class FeatureStateGithubReposRequest(CoreApiEndpoint):
    config = CoreApiEndpointConfiguration(
        path="/github-repos/query/enabled",
        auth_required=False,
    )

    class RequestBody(BaseRequestBody):
        query_params: GithubReposFeatureStateInput

    class ResponseBody(BaseResponseBody):
        states_match: bool

    @classmethod
    async def perform(
        cls,
        team_id: uuid.UUID | str,
        account_id: Optional[uuid.UUID],
        access_token: Optional[str],
        **kwargs: Unpack[requests.CommonRequestArgs],
    ) -> ResponseBody:
        response = await requests.make_request(
            config=cls.config,
            input=None,
            team_id=team_id,
            account_id=account_id,
            access_token=access_token,
            **kwargs,
        )

        body = await cls.make_response(response, cls.ResponseBody)
        return body


class CreateGithubRepoRequest(CoreApiEndpoint):
    config = CoreApiEndpointConfiguration(
        path="/github-repos/create",
        auth_required=False,
    )

    class RequestBody(BaseRequestBody):
        repo: GithubRepoCreateInput

    class ResponseBody(BaseResponseBody):
        repo: GithubRepo

    @classmethod
    async def perform(
        cls,
        input: RequestBody,
        team_id: uuid.UUID | str,
        account_id: Optional[uuid.UUID],
        access_token: Optional[str],
        **kwargs: Unpack[requests.CommonRequestArgs],
    ) -> ResponseBody:
        response = await requests.make_request(
            config=cls.config,
            input=input,
            team_id=team_id,
            account_id=account_id,
            access_token=access_token,
            **kwargs,
        )

        body = await cls.make_response(response, cls.ResponseBody)
        return body


class DeleteGithubReposRequest(CoreApiEndpoint):
    config = CoreApiEndpointConfiguration(
        path="/github-repos/delete",
        auth_required=False,
    )

    class RequestBody(BaseRequestBody):
        repos: list[GithubReposDeleteInput]

    class ResponseBody(BaseResponseBody):
        pass

    @classmethod
    async def perform(
        cls,
        input: RequestBody,
        team_id: uuid.UUID | str,
        account_id: Optional[uuid.UUID],
        access_token: Optional[str],
        **kwargs: Unpack[requests.CommonRequestArgs],
    ) -> ResponseBody:
        response = await requests.make_request(
            config=cls.config,
            input=input,
            team_id=team_id,
            account_id=account_id,
            access_token=access_token,
            **kwargs,
        )

        body = await cls.make_response(response, cls.ResponseBody)
        return body


class UpdateGithubReposRequest(CoreApiEndpoint):
    config = CoreApiEndpointConfiguration(
        path="/github-repos/update",
        auth_required=False,
    )

    class RequestBody(BaseRequestBody):
        repos: list[GithubRepoUpdateInput]

    class ResponseBody(BaseResponseBody):
        repos: list[GithubRepo]

    @classmethod
    async def perform(
        cls,
        input: RequestBody,
        team_id: uuid.UUID | str,
        account_id: Optional[uuid.UUID],
        access_token: Optional[str],
        **kwargs: Unpack[requests.CommonRequestArgs],
    ) -> ResponseBody:
        response = await requests.make_request(
            config=cls.config,
            input=input,
            team_id=team_id,
            account_id=account_id,
            access_token=access_token,
            **kwargs,
        )

        body = await cls.make_response(response, cls.ResponseBody)
        return body
