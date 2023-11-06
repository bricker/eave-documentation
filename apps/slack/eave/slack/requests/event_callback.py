import http
from slack_bolt.async_app import AsyncBoltRequest
from slack_bolt.response import BoltResponse
from slack_sdk.signature import SignatureVerifier
import eave.stdlib.eave_origins as eave_origins
from eave.stdlib.http_endpoint import HTTPEndpoint
from eave.stdlib.logging import LogContext, eaveLogger
from eave.stdlib.slack_api.operations import SlackEventProcessorTaskOperation
from eave.stdlib.task_queue import create_task_from_request
from slack_bolt.adapter.starlette.async_handler import to_async_bolt_request
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from eave.stdlib.typing import JsonObject
from .. import slack_app
from ..config import SLACK_EVENT_QUEUE_NAME, app_config


class SlackEventCallbackHandler(HTTPEndpoint):
    _request: Request
    _bolt_request: AsyncBoltRequest
    _raw_body: bytes
    _json_body: JsonObject
    _ctx: LogContext

    async def post(self, request: Request) -> Response:
        self._ctx = LogContext(request.scope)

        eaveLogger.info("Request: POST /slack/events", self._ctx)

        default_success_response = Response(status_code=http.HTTPStatus.OK)
        self._request = request
        self._raw_body = await request.body()
        self._json_body = await request.json()

        # Replacement for SslCheck Middleware
        if self._is_ssl_check():
            return default_success_response

        # Replacement for UrlVerification Middleware
        if self._is_url_verification():
            return JSONResponse(status_code=200, content={"challenge": self._json_body.get("challenge")})

        # Replacement for RequestVerification Middleware
        if not self._is_signature_valid():
            eaveLogger.warning("Invalid Slack signature", self._ctx)
            # Returning success response for two reasons:
            # 1. So Slack doesn't retry the request
            # 2. So bad actors don't know if/why the request failed.
            return default_success_response

        # Replacement for internal AsyncListener middlewares
        # Throw away events that we don't care about.
        # The AsyncSlackRequestHandler does this, but doing it here avoids queueing any tasks that we know will be
        # rejected.
        if not await self._is_watched_event():
            eaveLogger.debug("Ignoring unmatched Slack event", self._ctx)
            return default_success_response

        self._bolt_request = to_async_bolt_request(req=self._request, body=self._raw_body)
        # await self._try_react()
        await self._create_task()
        return default_success_response

    def _is_ssl_check(self) -> bool:
        return self._json_body.get("ssl_check") == "1"

    def _is_url_verification(self) -> bool:
        return self._json_body.get("type") == "url_verification"

    def _is_signature_valid(self) -> bool:
        # Verify the Slack signature, to avoid creating Tasks on the queue for invalid requests.
        verifier = SignatureVerifier(signing_secret=app_config.eave_slack_app_signing_secret)
        headers = dict(self._request.headers)  # request.headers is a Mapping which is_valid_request won't accept
        return verifier.is_valid_request(body=self._raw_body, headers=headers)

    async def _is_watched_event(self) -> bool:
        bolt_request = to_async_bolt_request(req=self._request, body=self._raw_body)
        bolt_response = BoltResponse(status=200, body="")  # just a dummy value for the function
        for listener in slack_app.app._async_listeners:
            matches = await listener.async_matches(req=bolt_request, resp=bolt_response)
            if matches:
                return True

        # No matches
        return False

    # async def _try_react(self) -> None:
    #     event = self._json_body.get("event")
    #     if not event:
    #         eaveLogger.warning("Received payload without event field.")
    #         return

    #     client = self._bolt_request.context.client
    #     channel = event.get("channel")
    #     ts = event.get("ts")
    #     if client and channel and ts:
    #         await client.reactions_add(channel=channel, name="thumbsup", timestamp=ts)
    #     else:
    #         eaveLogger.warning("client, channel, or ts missing; cannot add reaction")

    async def _create_task(self) -> None:
        if team_id := self._json_body.get("team_id"):
            task_name_prefix = f"{team_id}-"
        else:
            task_name_prefix = None

        await create_task_from_request(
            target_path=SlackEventProcessorTaskOperation.config.path,
            queue_name=SLACK_EVENT_QUEUE_NAME,
            audience=eave_origins.EaveApp.eave_slack_app,
            origin=eave_origins.EaveApp.eave_slack_app,
            request=self._request,
            task_name_prefix=task_name_prefix,
            ctx=self._ctx,
        )
