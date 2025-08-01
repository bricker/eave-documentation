import { LifecycleRouter } from "@eave-fyi/eave-stdlib-ts/src/connect/lifecycle-router.js";
import { AtlassianProduct } from "@eave-fyi/eave-stdlib-ts/src/core-api/models/connect.js";
import {
  LogContext,
  eaveLogger,
} from "@eave-fyi/eave-stdlib-ts/src/logging.js";
import { jsonParser } from "@eave-fyi/eave-stdlib-ts/src/middleware/body-parser.js";
import { rawJsonBody } from "@eave-fyi/eave-stdlib-ts/src/middleware/common-middlewares.js";
import { AddOn } from "atlassian-connect-express";
import { Request, Response, Router } from "express";
import appConfig from "../config.js";

export function WebhookRouter({ addon }: { addon: AddOn }): Router {
  // webhooks
  const router = Router();
  router.use(rawJsonBody, jsonParser);
  router.use(addon.middleware());

  const lifecycleRouter = LifecycleRouter({
    addon,
    product: AtlassianProduct.confluence,
    eaveOrigin: appConfig.eaveOrigin,
  });
  router.use(lifecycleRouter);

  router.post(
    "/",
    addon.authenticate(),
    async (_req: Request, res: Response) => {
      const ctx = LogContext.load(res);
      eaveLogger.info("received webhook event", ctx);
    },
  );

  return router;
}
