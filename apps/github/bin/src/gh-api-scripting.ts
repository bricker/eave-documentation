// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unused-vars */
import yargs from "yargs/yargs";
import { LogContext } from "@eave-fyi/eave-stdlib-ts/src/logging.js";
import assert from "assert";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { loadStandardDotenvFiles } from "../../../../develop/javascript/dotenv-loader.cjs";
import { ExpressAPIDocumentBuilder } from "../../src/lib/api-documentation/builder.js";
import { CoreAPIData } from "../../src/lib/api-documentation/core-api.js";
import { GithubAPIData } from "../../src/lib/api-documentation/github-api.js";
import { compileQuery, graphql } from "../../src/lib/graphql-util.js";
import { createOctokitClient } from "../../src/lib/octokit-util.js";
import { generateExpressAPIDoc } from "../../src/tasks/run-api-documentation.js";

loadStandardDotenvFiles();

function log(k: string, o: any) {
  console.log(`\n=== ${k} ===`);
  console.dir(o, { depth: null, sorted: true, colors: true });
  console.log("===\n");
}

const ctx = new LogContext();

async function generateAPIDocs({ installId, teamId, externalRepoId }) {
  const octokit = await createOctokitClient(parseInt(installId, 10));
  const githubAPIData = new GithubAPIData({
    ctx,
    octokit,
    externalRepoId,
  });

  const coreAPIData = new CoreAPIData({
    teamId,
    ctx,
    externalRepoId,
  });

  const externalGithubRepo = await githubAPIData.getExternalGithubRepo();
  log("externalGithubRepo", externalGithubRepo);

  const expressRootDirs = await githubAPIData.getExpressRootDirs();
  log("expressRootDirs", expressRootDirs);

  await Promise.all(
    expressRootDirs.map(async (apiRootDir) => {
      const expressAPIInfo = await ExpressAPIDocumentBuilder.buildAPI({
        githubAPIData,
        coreAPIData,
        apiRootDir,
        ctx,
      });

      log("expressAPIInfo", expressAPIInfo);

      const newDocumentContents = await generateExpressAPIDoc({
        expressAPIInfo,
        ctx,
      });
      log("newDocumentContents", newDocumentContents);
    }),
  );
}

async function getPullRequestFiles({ installId, teamId, externalRepoId }) {
  const octokit = await createOctokitClient(parseInt(installId, 10));
  const githubAPIData = new GithubAPIData({
    ctx,
    octokit,
    externalRepoId,
  });

  const externalGithubRepo = await githubAPIData.getExternalGithubRepo();
  console.log("externalGithubRepo", externalGithubRepo);

  let query = await compileQuery(
    graphql(`
      query ($repoOwner: String!, $repoName: String!, $prNumber: Int!) {
        repository(owner: $repoOwner, name: $repoName) {
          pullRequest(number: $prNumber) {
            files(first: 100) {
              nodes {
                path
              }
            }

            title
            body
            headRefName
            headRef {
              target {
                __typename
                oid
              }
            }
          }
        }
      }
    `),
  );

  let r: any = await octokit.graphql(query, {
    repoOwner: externalGithubRepo.owner.login,
    repoName: externalGithubRepo.name,
    prNumber: 0, // FIXME
  });

  console.log(r);

  const headRefName = r.repository.pullRequest.headRefName;
  const filePaths = r.repository.pullRequest.files.nodes.map(
    (n: any) => n.path,
  );

  query = await compileQuery(
    graphql(`
      query ($repoOwner: String!, $repoName: String!, $expression: String!) {
        repository(owner: $repoOwner, name: $repoName) {
          object(expression: $expression) {
            __typename
            ... on Blob {
              text
            }
          }
        }
      }
    `),
  );

  for (const p of filePaths) {
    r = await octokit.graphql(query, {
      repoOwner: externalGithubRepo.owner.login,
      repoName: externalGithubRepo.name,
      expression: `${headRefName}:${p}`,
    });
    console.log(r);
  }
}


async function getRepoContents({ installId, externalRepoId }) {
  const octokit = await createOctokitClient(parseInt(installId, 10));
  const githubAPIData = new GithubAPIData({
    ctx,
    octokit,
    externalRepoId,
  });

  const externalGithubRepo = await githubAPIData.getExternalGithubRepo();
  log("externalGithubRepo", externalGithubRepo);

  const expressRootDirs = await githubAPIData.getExpressRootDirs();
  log("expressRootDirs", expressRootDirs);
}

const argv = yargs(process.argv.slice(2)).argv;
console.table(argv);

const op = argv["op"];

switch (op) {
  case "getRepoContents":
    void getRepoContents(argv);
    break;
  case "generateAPIDocs":
    void generateAPIDocs(argv);
    break;
  case "getPullRequestFiles":
    void getPullRequestFiles(argv);
    break;
  default:
    throw new Error("Invalid op");
}
