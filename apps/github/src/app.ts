import {
  StatusRouter,
  addGAELifecycleRoutes,
  handlerWrapper,
  makeRoute,
} from "@eave-fyi/eave-stdlib-ts/src/api-util.js";
import { CreateGithubPullRequestOperation } from "@eave-fyi/eave-stdlib-ts/src/github-api/operations/create-pull-request.js";
import { CreateGithubResourceSubscriptionOperation } from "@eave-fyi/eave-stdlib-ts/src/github-api/operations/create-subscription.js";
import { CronTriggerOperation } from "@eave-fyi/eave-stdlib-ts/src/github-api/operations/cron-trigger.js";
import { GithubEventHandlerTaskOperation } from "@eave-fyi/eave-stdlib-ts/src/github-api/operations/event-handler-task.js";
import { GetGithubUrlContentOperation } from "@eave-fyi/eave-stdlib-ts/src/github-api/operations/get-content.js";
import { QueryGithubReposOperation } from "@eave-fyi/eave-stdlib-ts/src/github-api/operations/query-repos.js";
import { RunApiDocumentationTaskOperation } from "@eave-fyi/eave-stdlib-ts/src/github-api/operations/run-api-documentation-task.js";
import { VerifyInstallationOperation } from "@eave-fyi/eave-stdlib-ts/src/github-api/operations/verify-installation.js";
import { jsonParser } from "@eave-fyi/eave-stdlib-ts/src/middleware/body-parser.js";
import {
  commonRequestMiddlewares,
  commonResponseMiddlewares,
  helmetMiddleware,
  rawJsonBody,
} from "@eave-fyi/eave-stdlib-ts/src/middleware/common-middlewares.js";
import express from "express";
import { getContentSummaryHandler } from "./api/content.js";
import { createPullRequestHandler } from "./api/create-pull-request.js";
import { queryReposHandler } from "./api/repos.js";
import { subscribeHandler } from "./api/subscribe.js";
import { verifyInstallation } from "./api/verify-installation.js";
import { cronDispatchHandler } from "./cron/cron-dispatch.js";
import { webhookEventHandler } from "./events/webhook.js";
import { validateGithubWebhookHeaders } from "./middleware/process-webhook-payload.js";
import { runApiDocumentationTaskHandler } from "./tasks/run-api-documentation.js";
import { webhookEventTaskHandler } from "./tasks/webhook-event-dispatch.js";

export const app = express();
app.use(helmetMiddleware());
app.use(commonRequestMiddlewares);
app.use("/github/status", StatusRouter());
addGAELifecycleRoutes({ router: app });

// Github Webhook endpoint
// This doesn't use `makeRoute` because it uses a special middleware
app.post(
  "/github/events",
  rawJsonBody,
  validateGithubWebhookHeaders,
  jsonParser,
  handlerWrapper(webhookEventHandler),
);

// API Endpoints
makeRoute({
  router: app,
  config: GetGithubUrlContentOperation.config,
  handler: getContentSummaryHandler,
});
makeRoute({
  router: app,
  config: CreateGithubResourceSubscriptionOperation.config,
  handler: subscribeHandler,
});
makeRoute({
  router: app,
  config: CreateGithubPullRequestOperation.config,
  handler: createPullRequestHandler,
});
makeRoute({
  router: app,
  config: QueryGithubReposOperation.config,
  handler: queryReposHandler,
});
makeRoute({
  router: app,
  config: VerifyInstallationOperation.config,
  handler: verifyInstallation,
});

// Offline Tasks
makeRoute({
  router: app,
  config: RunApiDocumentationTaskOperation.config,
  handler: runApiDocumentationTaskHandler,
});
makeRoute({
  router: app,
  config: GithubEventHandlerTaskOperation.config,
  handler: webhookEventTaskHandler,
});
makeRoute({
  router: app,
  config: CronTriggerOperation.config,
  handler: cronDispatchHandler,
});

app.use(commonResponseMiddlewares);
