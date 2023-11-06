import asyncio
from dataclasses import dataclass
import json
from typing import Any, Coroutine, Optional, TypeVar
from google.cloud import tasks
from starlette.requests import Request
from eave.stdlib import cache
import eave.stdlib.signing as signing
from eave.stdlib.eave_origins import EaveApp
from eave.stdlib.headers import (
    CONTENT_TYPE,
    EAVE_ACCOUNT_ID_HEADER,
    EAVE_ORIGIN_HEADER,
    EAVE_REQUEST_ID_HEADER,
    EAVE_SIG_TS_HEADER,
    EAVE_SIGNATURE_HEADER,
    EAVE_TEAM_ID_HEADER,
    GCP_CLOUD_TRACE_CONTEXT,
    GCP_GAE_REQUEST_LOG_ID,
    USER_AGENT,
)
from eave.stdlib.time import ONE_DAY_IN_MS
from eave.stdlib.util import compact_deterministic_json, ensure_bytes, ensure_str

from .typing import JsonObject
from .config import shared_config
from .logging import LogContext, eaveLogger

T = TypeVar("T")

asyncio_tasks = set[asyncio.Task[Any]]()


def do_in_background(coro: Coroutine[Any, Any, T]) -> asyncio.Task[T]:
    task = asyncio.create_task(coro)
    asyncio_tasks.add(task)
    task.add_done_callback(asyncio_tasks.discard)
    return task


async def get_queue(queue_name: str) -> tasks.Queue:
    client = tasks.CloudTasksAsyncClient()

    queue = client.queue_path(
        project=shared_config.google_cloud_project,
        location=shared_config.app_location,
        queue=queue_name,
    )

    queue = await client.get_queue(name=queue)
    return queue


@dataclass
class BodyCacheEntry:
    cache_key: str


async def create_task_from_request(
    queue_name: str,
    target_path: str,
    request: Request,
    origin: EaveApp,
    audience: EaveApp,
    ctx: Optional[LogContext],
    unique_task_id: Optional[str] = None,
    task_name_prefix: Optional[str] = None,
) -> None:
    ctx = LogContext.wrap(ctx)

    if not unique_task_id:
        if trace_id := request.headers.get(GCP_CLOUD_TRACE_CONTEXT):
            unique_task_id = trace_id.split("/")[0]
        elif log_id := request.headers.get(GCP_GAE_REQUEST_LOG_ID):
            unique_task_id = log_id

    # Stash in redis to avoid 100kb payload size limit in Cloud Tasks
    payload = await request.body()
    cache_client = cache.client_or_exception()
    pointer_payload = BodyCacheEntry(cache_key=ctx.eave_request_id)
    await cache_client.set(name=pointer_payload.cache_key, value=ensure_str(payload), ex=ONE_DAY_IN_MS)
    payload = compact_deterministic_json(pointer_payload.__dict__)

    headers = dict(request.headers)

    # The "user agent" is Slack Bot when coming from Slack, but for the task processor that's not the case.
    headers.pop(USER_AGENT, None)

    await create_task(
        queue_name=queue_name,
        target_path=target_path,
        payload=payload,
        origin=origin,
        audience=audience,
        unique_task_id=unique_task_id,
        task_name_prefix=task_name_prefix,
        headers=headers,
        ctx=ctx,
    )


async def create_task(
    queue_name: str,
    target_path: str,
    payload: JsonObject | str | bytes,
    origin: EaveApp,
    audience: EaveApp,
    ctx: Optional[LogContext],
    unique_task_id: Optional[str] = None,
    task_name_prefix: Optional[str] = None,
    headers: Optional[dict[str, str]] = None,
) -> tasks.Task:
    ctx = LogContext.wrap(ctx)

    if not headers:
        headers = {}

    eave_sig_ts = signing.make_sig_ts()

    team_id = headers.get(EAVE_TEAM_ID_HEADER) or ctx.eave_team_id
    account_id = headers.get(EAVE_ACCOUNT_ID_HEADER) or ctx.eave_account_id
    request_id = headers.get(EAVE_REQUEST_ID_HEADER) or ctx.eave_request_id

    signature_message = signing.build_message_to_sign(
        method="POST",
        origin=origin,
        ts=eave_sig_ts,
        audience=audience,
        request_id=request_id,
        path=target_path,
        payload=ensure_str(payload),
        team_id=team_id,
        account_id=account_id,
        ctx=ctx,
    )

    signature = signing.sign_b64(signing_key=signing.get_key(origin), data=signature_message)

    headers[CONTENT_TYPE] = "application/json"
    headers[EAVE_SIGNATURE_HEADER] = signature
    headers[EAVE_SIG_TS_HEADER] = str(eave_sig_ts)
    headers[EAVE_ORIGIN_HEADER] = origin.value

    if account_id and not headers.get(EAVE_ACCOUNT_ID_HEADER):
        headers[EAVE_ACCOUNT_ID_HEADER] = account_id
    if team_id and not headers.get(EAVE_TEAM_ID_HEADER):
        headers[EAVE_TEAM_ID_HEADER] = team_id
    if request_id and not headers.get(EAVE_REQUEST_ID_HEADER):
        headers[EAVE_REQUEST_ID_HEADER] = request_id

    client = tasks.CloudTasksAsyncClient()

    parent = client.queue_path(
        project=shared_config.google_cloud_project,
        location=shared_config.app_location,
        queue=queue_name,
    )

    task = tasks.Task(
        app_engine_http_request=tasks.AppEngineHttpRequest(
            http_method=tasks.HttpMethod.POST,
            relative_uri=target_path,
            headers=headers,
            body=ensure_bytes(data=payload),
        )
    )

    if unique_task_id:
        if task_name_prefix:
            unique_task_id = f"{task_name_prefix}{unique_task_id}"

        # If this isn't given, Cloud Tasks creates a unique task name automatically.
        task.name = client.task_path(
            project=shared_config.google_cloud_project,
            location=shared_config.app_location,
            queue=queue_name,
            task=unique_task_id,
        )

    eaveLogger.debug(
        f"Creating task on queue {queue_name}",
        ctx,
        {
            "task_name": task.name,
            "queue_name": parent,
        },
    )

    t = await client.create_task(parent=parent, task=task)
    return t


async def get_cached_payload(body: str | bytes) -> str:
    jbody = json.loads(body)
    try:
        pointer_payload = BodyCacheEntry(**jbody)
    except TypeError as e:
        eaveLogger.error("Invalid BodyCacheEntry payload!")
        raise e

    cache_client = cache.client_or_exception()
    stashed_payload = await cache_client.get(name=pointer_payload.cache_key)
    assert stashed_payload is not None, "Could not find expected cached event body. Maybe the TTL needs to be extended?"

    return stashed_payload
