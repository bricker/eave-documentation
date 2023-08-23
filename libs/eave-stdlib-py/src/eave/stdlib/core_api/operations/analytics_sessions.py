from typing import Optional, Unpack
import uuid
from eave.stdlib.core_api.models.analytics_session import AnalyticsSession, AnalyticsSessionInput
from . import BaseRequestBody, BaseResponseBody, EndpointConfiguration

from . import Endpoint
from ..models import team
from ... import requests


class CreateAnalyticsSessionRequest(Endpoint):
    config = EndpointConfiguration(
        path="/sessions/create",
        auth_required=False,
        team_id_required=False,
        signature_required=False,
    )

    class RequestBody(BaseRequestBody):
        analytics_session: AnalyticsSessionInput

    class ResponseBody(BaseResponseBody):
        analytics_session: AnalyticsSession

    @classmethod
    async def perform(
        cls,
        input: RequestBody,
        **kwargs: Unpack[requests.CommonRequestArgs],
    ) -> ResponseBody:
        response = await requests.make_request(
            url=cls.config.url,
            input=input,
            **kwargs,
        )

        response_json = await response.json()
        return cls.ResponseBody(**response_json, _raw_response=response)
