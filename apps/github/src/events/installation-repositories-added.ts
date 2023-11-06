import { Team } from "@eave-fyi/eave-stdlib-ts/src/core-api/models/team.js";
import {
  CreateGithubRepoOperation,
  GetGithubReposOperation,
} from "@eave-fyi/eave-stdlib-ts/src/core-api/operations/github-repos.js";
import { EaveApp } from "@eave-fyi/eave-stdlib-ts/src/eave-origins.js";
import { CtxArg } from "@eave-fyi/eave-stdlib-ts/src/requests.js";
import { InstallationRepositoriesAddedEvent } from "@octokit/webhooks-types";
import { EventHandlerArgs } from "../types.js";

/**
 * Receives github webhook installation_repositories events.
 * https://docs.github.com/en/webhooks/webhook-events-and-payloads#installation_repositories
 *
 * Features:
 * Inserts rows into the github_repos db table with feature activation states matching
 * the other rows in the table whenever it is given access to new repos in GitHub.
 */
export default async function handler({
  event,
  ctx,
  eaveTeam,
}: EventHandlerArgs & {
  event: InstallationRepositoriesAddedEvent;
}) {
  if (event.action !== "added") {
    return;
  }

  await maybeAddReposToDataBase({ event, ctx, eaveTeam });
}

export async function maybeAddReposToDataBase({
  event,
  ctx,
  eaveTeam,
}: CtxArg & { eaveTeam: Team; event: InstallationRepositoriesAddedEvent }) {
  const sharedReqInput = {
    teamId: eaveTeam.id,
    origin: EaveApp.eave_github_app,
    ctx,
  };

  const res = await GetGithubReposOperation.perform({
    ...sharedReqInput,
    input: {},
  });

  if (res.repos.length < 1) {
    // exit early; website app handles adding first repo(s) to the db
    return;
  }

  for (const repo of event.repositories_added) {
    await CreateGithubRepoOperation.perform({
      ...sharedReqInput,
      input: {
        repo: {
          external_repo_id: repo.node_id,
          display_name: repo.name,
        },
      },
    });
  }
}
