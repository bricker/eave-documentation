import { CloudTasksClient, protos } from "@google-cloud/tasks";
import { Request } from "express";
import assert from "node:assert";
import { constants as httpConstants } from "node:http2";
import { ClientApiEndpointConfiguration } from "./api-util.js";
import { getCacheClient } from "./cache.js";
import { sharedConfig } from "./config.js";
import { EaveApp } from "./eave-origins.js";
import {
  EAVE_ACCOUNT_ID_HEADER,
  EAVE_ORIGIN_HEADER,
  EAVE_REQUEST_ID_HEADER,
  EAVE_SIGNATURE_HEADER,
  EAVE_SIG_TS_HEADER,
  EAVE_TEAM_ID_HEADER,
  GCP_CLOUD_TRACE_CONTEXT,
  GCP_GAE_REQUEST_LOG_ID,
  MIME_TYPE_JSON,
} from "./headers.js";
import { LogContext, eaveLogger } from "./logging.js";
import { CtxArg, makeRequest } from "./requests.js";
import Signing, { buildMessageToSign, makeSigTs } from "./signing.js";
import { ExpressRoutingMethod } from "./types.js";
import { makeString } from "./util.js";

type CreateTaskSharedArgs = CtxArg & {
  queueName: string;
  targetPath: string;
  origin: EaveApp;
  audience: EaveApp;
  uniqueTaskId?: string;
  taskNamePrefix?: string;
};

type CreateTaskArgs = CreateTaskSharedArgs & {
  payload: any;
  headers?: { [key: string]: string };
};

type CreateTaskFromRequestArgs = CreateTaskSharedArgs & {
  req: Request;
};

type BodyCacheEntry = {
  cacheKey: string;
};

export async function createTaskFromRequest({
  queueName,
  targetPath,
  origin,
  audience,
  uniqueTaskId,
  taskNamePrefix,
  req,
  ctx,
}: CreateTaskFromRequestArgs): Promise<void> {
  ctx = LogContext.wrap(ctx, req);

  // keep the event in redis since GCP Task Queue can only accept 100kb task size
  let payload = req.body;
  const pointerPayload: BodyCacheEntry = { cacheKey: ctx.eave_request_id };
  const cacheClient = await getCacheClient();
  await cacheClient.set(pointerPayload.cacheKey, makeString(payload), {
    EX: 60 * 60 * 24,
  }); // TTL 24h

  payload = makeString(pointerPayload);

  if (!uniqueTaskId) {
    const traceId = req.header(GCP_CLOUD_TRACE_CONTEXT);
    const logId = req.header(GCP_GAE_REQUEST_LOG_ID);

    if (traceId) {
      uniqueTaskId = traceId.split("/")[0];
    } else if (logId) {
      uniqueTaskId = logId;
    }
  }

  const headers: { [key: string]: string } = {};
  // FIXME: Is there a cleaner way to do this? req.headers is a NodeJS.Dict typescript object.
  // eslint-disable-next-line no-restricted-syntax
  for (const key in req.headers) {
    if (Object.hasOwn(req.headers, key)) {
      // express joins array values into string values for headers
      const value = req.header(key)!;
      headers[key] = value;
    }
  }

  // The "user agent" is the GitHub webhook deliverer, but when passing off to the task processor, that's not true.
  // GCP Task Queue merges the user agents.
  delete headers[httpConstants.HTTP2_HEADER_USER_AGENT];

  await createTask({
    targetPath,
    queueName,
    audience,
    origin,
    uniqueTaskId,
    taskNamePrefix,
    payload,
    headers,
    ctx,
  });
}

export async function createTask({
  queueName,
  targetPath,
  payload,
  headers,
  origin,
  audience,
  uniqueTaskId,
  taskNamePrefix,
  ctx,
}: CreateTaskArgs): Promise<void> {
  ctx = LogContext.wrap(ctx);

  payload = makeString(payload);

  if (!headers) {
    headers = {};
  }

  const teamId = headers[EAVE_TEAM_ID_HEADER] || ctx.eave_team_id;
  const accountId = headers[EAVE_ACCOUNT_ID_HEADER] || ctx.eave_account_id;
  const requestId = headers[EAVE_REQUEST_ID_HEADER] || ctx.eave_request_id;

  const eaveSigTs = makeSigTs();

  const signatureMessage = buildMessageToSign({
    method: httpConstants.HTTP2_METHOD_POST,
    path: targetPath,
    ts: eaveSigTs,
    requestId,
    origin,
    audience,
    payload,
    teamId,
    accountId,
    ctx,
  });

  const signing = Signing.new(origin);
  const signature = await signing.signBase64(signatureMessage);

  headers[httpConstants.HTTP2_HEADER_CONTENT_TYPE] = MIME_TYPE_JSON;
  headers[EAVE_SIGNATURE_HEADER] = signature;
  headers[EAVE_ORIGIN_HEADER] = origin;
  headers[EAVE_SIG_TS_HEADER] = eaveSigTs.toString();

  if (requestId && !headers[EAVE_REQUEST_ID_HEADER]) {
    headers[EAVE_REQUEST_ID_HEADER] = requestId;
  }

  if (accountId && !headers[EAVE_ACCOUNT_ID_HEADER]) {
    headers[EAVE_ACCOUNT_ID_HEADER] = accountId;
  }

  if (teamId && !headers[EAVE_TEAM_ID_HEADER]) {
    headers[EAVE_TEAM_ID_HEADER] = teamId;
  }

  const client = new CloudTasksClient();
  const parent = client.queuePath(
    sharedConfig.googleCloudProject,
    sharedConfig.appLocation,
    queueName,
  );

  const task: protos.google.cloud.tasks.v2.ITask = {
    appEngineHttpRequest: {
      headers,
      httpMethod: "POST",
      relativeUri: targetPath,
      body: Buffer.from(payload).toString("base64"),
    },
  };

  assert(task.appEngineHttpRequest);

  if (uniqueTaskId) {
    if (taskNamePrefix) {
      uniqueTaskId = `${taskNamePrefix}${uniqueTaskId}`;
    }

    // If this isn't given, Cloud Tasks creates a unique task name automatically.
    task.name = client.taskPath(
      sharedConfig.googleCloudProject,
      sharedConfig.appLocation,
      queueName,
      uniqueTaskId,
    );
  }

  eaveLogger.debug(`Creating task on queue ${queueName}`, ctx, {
    // fields are snake cased for consistency with Python
    task: {
      name: task.name,
      body: task.appEngineHttpRequest.body?.toString(),
      headers: task.appEngineHttpRequest.headers,
    },
    queue_name: parent,
  });

  if (sharedConfig.isDevelopment) {
    const host = sharedConfig.eavePublicServiceBase(origin);

    const endpointConfig: ClientApiEndpointConfiguration = {
      path: task.appEngineHttpRequest.relativeUri!,
      url: `${host}${task.appEngineHttpRequest.relativeUri}`,
      audience,
      method: ExpressRoutingMethod.post,
    };

    /*
    In development only, signature is done twice: once in this function, and again in `makeRequest`. Not ideal but not worth refactoring this function to prevent it.

    The purpose of having this development block at the bottom of the function is to run as much code as possible in development. Cloud Tasks doesn't have an official local emulator as of this writing, so placing a job on the queue isn't useful during development.

    So in development, we bypass the queue and make the request directly to the target app. It's not a great solution! [This](https://github.com/aertje/cloud-tasks-emulator) exists, but it's a) third-party, and b) requires either `go` or `docker`, which currently would complicate development/onboarding too much to be worth it.
    */
    await makeRequest({
      config: endpointConfig,
      origin,
      ctx,
      input: payload, // not b64 encoded
      addlHeaders: task.appEngineHttpRequest.headers || undefined,
    });
  }

  await client.createTask({ parent, task });
}

export async function getCachedPayload(req: Request): Promise<string> {
  const cacheEntry: BodyCacheEntry = req.body;
  if (cacheEntry.cacheKey === undefined) {
    throw Error("Request body did not contain a cache key");
  }

  const cacheClient = await getCacheClient();
  const cachedBody = await cacheClient.get(cacheEntry.cacheKey);
  if (!cachedBody) {
    throw Error(
      "Could not find expected cached event body. Maybe the TTL needs to be extended?",
    );
  }
  return makeString(cachedBody);
}
