import { VerifyInstallationRequestBody } from "@eave-fyi/eave-stdlib-ts/src/github-api/operations/verify-installation.js";
import {
  LogContext,
  eaveLogger,
} from "@eave-fyi/eave-stdlib-ts/src/logging.js";
import { Request, Response } from "express";
import { Octokit } from "octokit";
import { appConfig } from "../config.js";
import { githubAppClient } from "../lib/octokit-util.js";

/**
 * Manually verify a github app installation ID and OAuth user code
 * to try to protect against spoofed app install callback requests.
 * https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/about-the-setup-url
 *
 * Responds with 200 on successful verification, or 401 if verification failed.
 */
export async function verifyInstallation(
  req: Request,
  res: Response,
): Promise<void> {
  const ctx = LogContext.load(res);

  // validate input
  const input = <VerifyInstallationRequestBody>req.body;
  if (!(input.code && input.installation_id)) {
    eaveLogger.error("Invalid input", ctx);
    res.status(400).json();
    return;
  }

  const appOctokit = await githubAppClient();

  // exchange code for an access token
  const {
    authentication: { token },
  } = await appOctokit.oauth.createToken({ code: input.code });

  // use access token to find list of installations the user has explicit access to
  // https://docs.github.com/en/rest/apps/installations?apiVersion=2022-11-28#list-app-installations-accessible-to-the-user-access-token
  const userOctokit = new Octokit({
    auth: token,
  });

  const {
    data: { installations: accessibleInstallations },
  } = await userOctokit.request("GET /user/installations", {
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  // verify the provided installation is in that list
  const installation = accessibleInstallations.find(
    (install) => install.id.toString() === input.installation_id,
  );
  if (installation === undefined) {
    eaveLogger.warning(
      "Failed to find installation_id in list of accessible GitHub app installations",
      ctx,
    );
    res.status(401).json();
    return;
  }

  // verify the installation is an Eave app installation
  if (installation.app_id.toString() !== (await appConfig.eaveGithubAppId)) {
    eaveLogger.warning(
      "The installation_id was not an Eave GitHub app ID",
      ctx,
    );
    res.status(401).json();
    return;
  }

  res.status(200).json();
}
