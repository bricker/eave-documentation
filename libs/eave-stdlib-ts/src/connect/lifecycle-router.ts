import AddOnFactory, { AddOn } from "atlassian-connect-express";
import { Request, Response, Router } from "express";
import { AtlassianProduct } from "../core-api/models/connect.js";
import { RegisterConnectInstallationOperation } from "../core-api/operations/connect.js";
import { EaveApp } from "../eave-origins.js";
import { LogContext, eaveLogger } from "../logging.js";

export function LifecycleRouter({
  addon,
  product,
  eaveOrigin,
}: {
  addon: AddOn;
  product: AtlassianProduct;
  eaveOrigin: EaveApp;
}): Router {
  const router = Router();

  // A custom implementation of the atlassian-connect-express built-in install handler.
  router.post(
    "/installed",
    addon.verifyInstallation(),
    async (req: Request, res: Response) => {
      const settings: AddOnFactory.ClientInfo = req.body;
      const ctx = new LogContext(req);
      await RegisterConnectInstallationOperation.perform({
        ctx,
        origin: eaveOrigin,
        input: {
          connect_integration: {
            product,
            client_key: settings.clientKey,
            base_url: settings.baseUrl,
            shared_secret: settings.sharedSecret,
            description: settings.description,
            atlassian_actor_account_id: null,
            display_url: null,
          },
        },
      });

      await addon.settings.set("clientInfo", settings, settings.clientKey);
      res.sendStatus(204);
    },
  );

  router.post("/enabled", async (req: Request, res: Response) => {
    const ctx = new LogContext(req);

    eaveLogger.info(
      "received enabled lifecycle event",
      {
        body: req.body,
        product,
        eaveOrigin,
      },
      ctx,
    );
    res.sendStatus(204);
  });

  router.post("/disabled", async (req: Request, res: Response) => {
    const ctx = new LogContext(req);
    eaveLogger.info(
      "received disabled lifecycle event",
      {
        body: req.body,
        product,
        eaveOrigin,
      },
      ctx,
    );
    res.sendStatus(204);
  });

  router.post(
    "/uninstalled",
    addon.verifyInstallation(),
    async (req: Request, res: Response) => {
      const ctx = new LogContext(req);
      eaveLogger.info(
        "received uninstalled lifecycle event",
        {
          body: req.body,
          product,
          eaveOrigin,
        },
        ctx,
      );
      res.sendStatus(204);
    },
  );

  return router;
}
