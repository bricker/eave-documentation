import {
  LogContext,
  eaveLogger,
} from "@eave-fyi/eave-stdlib-ts/src/logging.js";
import {
  EmitterWebhookEvent,
  EmitterWebhookEventName,
} from "@octokit/webhooks";
import { InstallationLite, WebhookEventName } from "@octokit/webhooks-types";
import Express from "express";
import { constants as httpConstants } from "node:http2";
import { appConfig } from "../config.js";
import {
  HandlerFunction,
  getEventHandler as getEventHandlerFromRegistry,
} from "../events/event-registry.js";
import { githubAppClient } from "../lib/octokit-util.js";

type GithubWebhookHeaders = {
  id?: string;
  signature?: string;
  githubAppId?: string;
  eventName?: WebhookEventName;
};

export type GithubWebhookBody = EmitterWebhookEvent<EmitterWebhookEventName> & {
  installation: InstallationLite;
  action?: string;
};

export function getGithubWebhookHeaders(
  req: Express.Request,
): GithubWebhookHeaders {
  const id = req.header("x-github-delivery");

  /*
    This header contains the "WebhookEventName", which is what Github calls it but is a misnomer imo.
    An "Event" (available in the headers) in this context is the object type. For example: "issues", "pull_request", "milestone".
    An "Action" (available in the request body) is the, er, action that triggered the webhook. For example: "created", "closed", "edited".
    So, an app subscribes to "Events", which includes all of its "Actions".
    To add more confusion, some "Events" are actually Events and don't have any "Actions", like the "push" event.
    But, generally, you can think of the "Event" (in Github terms) to be the subject of the action, and the "Action" to be the trigger.
    It seems silly to separate the "Event" and "Action" values, because one is useless without the other.
  */
  const eventName = req.header("x-github-event") as
    | WebhookEventName
    | undefined;
  const signature = req.header("x-hub-signature-256");
  const githubAppId = req.header("x-github-hook-installation-target-id");

  return {
    id,
    signature,
    githubAppId,
    eventName,
  };
}

export function getEventHandler(
  req: Express.Request,
  res: Express.Response,
  eventBody: GithubWebhookBody,
): HandlerFunction | undefined {
  const ctx = LogContext.load(res);
  const { eventName } = getGithubWebhookHeaders(req);
  const { action } = eventBody;
  const fullEventName = [eventName, action].filter((n) => n).join(".");

  const handler = getEventHandlerFromRegistry({ dispatchKey: fullEventName });
  if (!handler) {
    eaveLogger.warning(`Event not supported: ${fullEventName}`, ctx);
  }

  return handler;
}

export async function validateGithubWebhookHeaders(
  req: Express.Request,
  res: Express.Response,
  next: Express.NextFunction,
): Promise<void> {
  try {
    const ctx = LogContext.load(res);
    const rawBody = (<Buffer>req.body).toString();
    const { id, signature, eventName, githubAppId } =
      getGithubWebhookHeaders(req);

    if (!eventName || !id || !signature || !githubAppId) {
      eaveLogger.error("missing header data from GitHub", ctx, {
        id,
        eventName,
        githubAppId,
      });
      res.sendStatus(httpConstants.HTTP_STATUS_BAD_REQUEST);
      return;
    }

    const app = await githubAppClient();
    const verified = await app.webhooks.verify(rawBody, signature);

    if (!verified) {
      eaveLogger.error("signature verification failed", ctx, {
        id,
        eventName,
        githubAppId,
      });

      if (appConfig.isDevelopment && appConfig.devMode) {
        eaveLogger.warning(
          "bypassing signature verification failure in dev mode",
          ctx,
        );
      } else {
        res.sendStatus(httpConstants.HTTP_STATUS_BAD_REQUEST);
        return;
      }
    }

    next();
  } catch (e: any) {
    next(e);
  }
}
