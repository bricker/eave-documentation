import { logEvent } from "@eave-fyi/eave-stdlib-ts/src/analytics.js";
import {
  GithubDocument,
  GithubDocumentStatus,
} from "@eave-fyi/eave-stdlib-ts/src/core-api/models/github-documents.js";
import {
  GithubRepo,
  GithubRepoFeatureState,
} from "@eave-fyi/eave-stdlib-ts/src/core-api/models/github-repos.js";
import { Team } from "@eave-fyi/eave-stdlib-ts/src/core-api/models/team.js";
import {
  GetGithubDocumentsOperation,
  UpdateGithubDocumentOperation,
} from "@eave-fyi/eave-stdlib-ts/src/core-api/operations/github-documents.js";
import { GetGithubReposOperation } from "@eave-fyi/eave-stdlib-ts/src/core-api/operations/github-repos.js";
import { updateDocumentation } from "@eave-fyi/eave-stdlib-ts/src/function-documenting.js";
import { FileChange } from "@eave-fyi/eave-stdlib-ts/src/github-api/models.js";
import { eaveLogger } from "@eave-fyi/eave-stdlib-ts/src/logging.js";
import { isSupportedProgrammingLanguage } from "@eave-fyi/eave-stdlib-ts/src/programming-langs/language-mapping.js";
import { CtxArg } from "@eave-fyi/eave-stdlib-ts/src/requests.js";
import { OpenAIModel } from "@eave-fyi/eave-stdlib-ts/src/transformer-ai/models.js";
import OpenAIClient, {
  formatprompt,
} from "@eave-fyi/eave-stdlib-ts/src/transformer-ai/openai.js";
import { assertPresence } from "@eave-fyi/eave-stdlib-ts/src/util.js";
import {
  Blob,
  Mutation,
  PullRequest,
  PullRequestChangedFile,
  PullRequestChangedFileConnection,
  Query,
  Repository,
  Scalars,
} from "@octokit/graphql-schema";
import { PullRequestEvent } from "@octokit/webhooks-types";
import { Octokit } from "octokit";
import path from "path";
import { API_BRANCH_NAME, appConfig } from "../config.js";
import * as GraphQLUtil from "../lib/graphql-util.js";
import { PullRequestCreator } from "../lib/pull-request-creator.js";
import { EventHandlerArgs } from "../types.js";

/**
 * Handles GitHub pull request events. If the event indicates a pull request has been closed, the function checks if the pull request was opened by a bot and if it contains API documentation changes. If so, it logs the event and updates the status of the documentation pull request. If the pull request was merged, it also deletes the API docs branch to prevent conflicts. If the pull request was not opened by a bot, the function checks if it was merged. If so, it fetches all the files from the pull request, filters out the ones that don't need documentation, and updates the documentation in each file. Finally, it creates a new pull request with the updated documentation.
 *
 * @param {Object} args - The arguments for the function.
 * @param {Object} args.event - The GitHub pull request event.
 * @param {Object} args.ctx - The context for the function.
 * @param {Object} args.octokit - The Octokit instance for making GitHub API calls.
 * @param {Object} args.eaveTeam - The Eave team instance.
 * @returns {Promise<void>} - A promise that resolves when the function has finished executing.
 * @throws {Error} If there is an error fetching file content or creating a pull request.
 */
export default async function handler({
  event,
  ctx,
  octokit,
  eaveTeam,
}: EventHandlerArgs & {
  event: PullRequestEvent;
}) {
  if (event.action !== "closed") {
    return;
  }
  ctx.feature_name = "inline_code_documentation";
  eaveLogger.debug("Processing github pull_request event", ctx);
  const repoOwner = event.repository.owner.login;
  const repoName = event.repository.name;
  const repoId = event.repository.node_id.toString();

  const eaveRepoResponse = await GetGithubReposOperation.perform({
    ctx,
    origin: appConfig.eaveOrigin,
    teamId: eaveTeam.id,
    input: {
      repos: [
        {
          external_repo_id: repoId,
        },
      ],
    },
  });

  // don't open more docs PRs from other Eave PRs getting merged
  if (
    event.pull_request.user.type === "Bot" &&
    event.pull_request.user.login.toLowerCase().match("^eave-fyi.*?\\[bot\\]$")
  ) {
    const documents = await getAssociatedGithubDocuments({
      eaveTeam,
      repos: eaveRepoResponse.repos,
      prNumber: event.pull_request.number,
      ctx,
    });

    // if there are api document changes, we can assume this is an API docs PR
    if (documents.length > 0) {
      ctx.feature_name = "api_documentation";

      // on merge, delete the API docs branch to prevent conflicts from
      // arising on future PRs
      if (event.pull_request.merged) {
        await deleteApiDocsBranch({
          octokit,
          repoName: event.repository.name,
          repoOwner: event.repository.owner.name!,
        });
      }
    }

    const interaction = event.pull_request.merged
      ? GithubDocumentStatus.PR_MERGED
      : GithubDocumentStatus.PR_CLOSED;
    if (interaction === GithubDocumentStatus.PR_MERGED) {
      await logEvent(
        {
          event_name: "github_eave_pr_merged",
          event_description: `A GitHub PR opened by Eave was merged`,
          event_source: "github webhook pull_request event",
          opaque_params: { interaction },
        },
        ctx,
      );
    } else {
      await logEvent(
        {
          event_name: "github_eave_pr_closed",
          event_description: `A GitHub PR opened by Eave was closed without merging changes`,
          event_source: "github webhook pull_request event",
          opaque_params: { interaction },
        },
        ctx,
      );
    }

    await updateDocsPullRequestStatus({
      documents,
      eaveTeam,
      ctx,
      status: interaction,
    });

    return;
  }

  // proceed only if PR commits were merged
  if (!event.pull_request.merged) {
    return;
  }

  if (
    !(await codeDocsEnabledForRepo({
      repos: eaveRepoResponse.repos,
      repoId: event.repository.id.toString(),
    }))
  ) {
    return;
  }

  const openaiClient = await OpenAIClient.getAuthedClient();

  let keepPaginating = true;
  let filePaths: Array<string> = [];
  const filesQuery = await GraphQLUtil.loadQuery("getFilesInPullRequest");
  const filesQueryVariables: {
    repoOwner: Scalars["String"]["input"];
    repoName: Scalars["String"]["input"];
    prNumber: Scalars["Int"]["input"];
    batchSize: Scalars["Int"]["input"];
    after?: Scalars["String"]["input"];
  } = {
    repoOwner,
    repoName,
    prNumber: event.pull_request.number,
    batchSize: 50, // max 100
  };

  // paginate to collect all files from the PR
  while (keepPaginating) {
    const queryResp = await octokit.graphql<{
      repository: Query["repository"];
    }>(filesQuery, filesQueryVariables);
    const prRepo = <Repository>queryResp.repository;
    const pr = <PullRequest>prRepo.pullRequest;
    const prFilesConnection = <PullRequestChangedFileConnection>pr.files;
    const prFileNodes = <Array<PullRequestChangedFile>>prFilesConnection.nodes;

    if (!prFileNodes) {
      eaveLogger.error(
        "Failed to acquire file list from PR while processing PR merge event",
        ctx,
      );
      return;
    }

    const documentableFiles: Array<PullRequestChangedFile> = [];
    for (const f of prFileNodes) {
      // dont document files that aren't new or modified
      if (!(f.changeType === "ADDED" || f.changeType === "MODIFIED")) {
        continue;
      }

      // filter file types that arent source files we support writing docs for
      if (!isSupportedProgrammingLanguage(path.extname(f.path))) {
        continue;
      }

      // TODO: would we get ratelimited if we tried to do all gpt prompts in parallel after all file paths obtained?
      // TODO: test feature behavior allowing test files to be documented. Should we allow that?
      const prompt = formatprompt(`
        Given a file path, determine whether that file typically needs function-level code comments.
        Respond with only YES, or NO. Generated and test files do not need documentation.

        src/main.c: YES
        README.md: NO
        scripts/setup.sh: NO
        bin/run: NO
        frontend/tests/LogicTests.js: NO
        ${f.path}:`);
      const openaiResponse = await openaiClient.createChatCompletion({
        parameters: {
          messages: [{ role: "user", content: prompt }],
          model: OpenAIModel.GPT4,
          max_tokens: 10,
        },
        ctx,
      });

      if (openaiResponse.trim() === "YES") {
        documentableFiles.push(f);
      }
    }

    filePaths = filePaths.concat(documentableFiles.map((f) => f.path));

    // assign query vars `after` field so that next query will continue paginating
    // files where the previous request left off
    filesQueryVariables.after =
      prFilesConnection.pageInfo.endCursor || undefined; // convert null to undefined for happy types
    keepPaginating = prFilesConnection.pageInfo.hasNextPage;
  }

  eaveLogger.debug("file paths", ctx, { repoId, filePaths });

  // update docs in each file
  const contentsQuery = await GraphQLUtil.loadQuery("getFileContentsByPath");
  const b64UpdatedContent = await Promise.all(
    filePaths.map(async (fpath): Promise<string | null> => {
      const contentsQueryVariables: {
        repoOwner: Scalars["String"]["input"];
        repoName: Scalars["String"]["input"];
        expression: Scalars["String"]["input"];
      } = {
        repoOwner,
        repoName,
        expression: `${event.pull_request.base.ref}:${fpath}`,
      };

      const response = await octokit.graphql<{
        repository: Query["repository"];
      }>(contentsQuery, contentsQueryVariables);
      const objectRepository = <Repository>response.repository;
      const gitObject = <Blob>objectRepository?.object;
      const fileContent = gitObject?.text;
      if (!fileContent) {
        eaveLogger.error(
          `Error fetching file content in ${repoOwner}/${repoName}`,
          ctx,
        );
        return null; // exits just this iteration of map
      }

      const updatedFileContent = await updateDocumentation({
        currContent: fileContent,
        filePath: fpath,
        openaiClient,
        ctx,
        fileNodeId: gitObject.id,
      });
      if (!updatedFileContent) {
        return null;
      }

      // encode new content as b64 bcus thats how github likes it
      return Buffer.from(updatedFileContent!).toString("base64");
    }),
  );

  try {
    const fileChanges = filePaths.reduce((acc, fpath, i) => {
      const content = b64UpdatedContent[i];
      // remove entries w/ null content from content fetch failures
      if (content) {
        acc.push({
          path: fpath,
          contents: content,
        });
      }
      return acc;
    }, Array<FileChange>());

    const prCreator = new PullRequestCreator({
      repoName,
      repoOwner,
      repoId,
      baseBranchName: event.pull_request.base.ref,
      octokit,
      ctx,
    });

    eaveLogger.debug("creating pull request for inline code docs", ctx, {
      repoId,
      pull_request_number: event.pull_request.number,
    });

    await prCreator.createPullRequest({
      branchName: `refs/heads/eave/auto-docs/${event.pull_request.number}`,
      commitMessage: "docs: automated update",
      fileChanges: { additions: fileChanges },
      prTitle: `docs: Eave inline code documentation update for #${event.pull_request.number}`,
      prBody: `Your new code docs based on changes from PR #${event.pull_request.number}`,
    });
  } catch (e: any) {
    eaveLogger.exception(e, ctx);
    return;
  }
}

/**
 * Retrieves the associated Github documents for a given repository and pull request.
 *
 * @param {Object} params - The parameters for the function.
 * @param {string} params.repoId - The ID of the Github repository.
 * @param {number} params.prNumber - The number of the pull request.
 * @param {Team} params.eaveTeam - The Eave team object to search for matching documents in.
 * @param {CtxArg} params.ctx - The context argument for log context.
 * @returns {Promise<GithubDocument[]>} A promise that resolves to an array of Github documents from backend.
 * @throws Will throw an error if the Github repository or documents cannot be retrieved.
 */
async function getAssociatedGithubDocuments({
  repos,
  prNumber,
  eaveTeam,
  ctx,
}: {
  repos: GithubRepo[];
  prNumber: number;
  eaveTeam: Team;
} & CtxArg): Promise<GithubDocument[]> {
  try {
    const eaveRepo = repos[0];
    assertPresence(eaveRepo);

    const associatedGithubDocuments = await GetGithubDocumentsOperation.perform(
      {
        origin: appConfig.eaveOrigin,
        ctx,
        teamId: eaveTeam.id,
        input: {
          query_params: {
            github_repo_id: eaveRepo.id,
            pull_request_number: prNumber,
          },
        },
      },
    );

    return associatedGithubDocuments.documents;
  } catch (e) {
    eaveLogger.error(
      "Failed to fetch associated github documents in pr closed webhook",
      ctx,
      { error: (<Error>e).message },
    );
    return [];
  }
}

/**
 * Updates the status of a pull request for a set of documents on Github.
 *
 * @async
 * @function updateDocsPullRequestStatus
 * @param {Object} arg - The argument object.
 * @param {Status} arg.status - The new status to be set for the documents.
 * @param {Team} arg.eaveTeam - The team responsible for the documents.
 * @param {GithubDocument[]} arg.documents - The array of documents to be updated.
 * @param {CtxArg} arg.ctx - The context argument.
 * @throws Will throw an error if the update operation fails.
 */
async function updateDocsPullRequestStatus({
  ctx,
  eaveTeam,
  documents,
  status,
}: {
  status: GithubDocumentStatus;
  eaveTeam: Team;
  documents: GithubDocument[];
} & CtxArg) {
  try {
    for (const document of documents) {
      await UpdateGithubDocumentOperation.perform({
        origin: appConfig.eaveOrigin,
        ctx,
        teamId: eaveTeam.id,
        input: {
          document: {
            id: document.id,
            new_values: {
              status,
            },
          },
        },
      });
    }
  } catch (e: any) {
    eaveLogger.exception(e, ctx);
    // Allow the function to continue running
  }
}

/**
 * Deletes a specific API documentation branch from a given repository.
 *
 * @param {Object} params - The parameters for the function.
 * @param {Octokit} params.octokit - The Octokit instance to interact with GitHub's GraphQL API.
 * @param {string} params.repoName - The name of the repository from which the branch will be deleted.
 * @param {string} params.repoOwner - The owner of the repository from which the branch will be deleted.
 *
 * @returns {Promise<void>} A promise that resolves when the branch has been deleted.
 *
 * @throws {Error} If the repository does not exist or the branch does not exist.
 */
async function deleteApiDocsBranch({
  octokit,
  repoName,
  repoOwner,
}: {
  octokit: Octokit;
  repoName: string;
  repoOwner: string;
}) {
  const getBranchQuery = await GraphQLUtil.loadQuery("getRef");
  const getBranchParameters: {
    repoName: Scalars["String"]["input"];
    repoOwner: Scalars["String"]["input"];
    refName: Scalars["String"]["input"];
  } = {
    repoName: repoName,
    repoOwner: repoOwner,
    refName: API_BRANCH_NAME,
  };

  const branchResp = await octokit.graphql<{
    repository: Query["repository"];
  }>(getBranchQuery, getBranchParameters);

  GraphQLUtil.assertIsRepository(branchResp.repository);
  const ref = branchResp.repository.ref;

  if (!ref) {
    // branch has already been deleted for us
    return;
  }

  const query = await GraphQLUtil.loadQuery("deleteBranch");
  const params: {
    refNodeId: Scalars["ID"]["input"];
  } = {
    refNodeId: ref.id,
  };
  await octokit.graphql<{ resp: Mutation["deleteRef"] }>(query, params);
}

async function codeDocsEnabledForRepo({
  repos,
  repoId,
}: {
  repoId: string;
  repos: GithubRepo[];
}): Promise<boolean> {
  const maybeRepo = repos.find((repo) => repo.external_repo_id === repoId);
  return (
    maybeRepo !== undefined &&
    maybeRepo.inline_code_documentation_state === GithubRepoFeatureState.ENABLED
  );
}
