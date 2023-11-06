import {
  LogContext,
  eaveLogger,
} from "@eave-fyi/eave-stdlib-ts/src/logging.js";
import { JsonValue } from "@eave-fyi/eave-stdlib-ts/src/types.js";
import { assertPresence } from "@eave-fyi/eave-stdlib-ts/src/util.js";
import {
  Blob,
  Commit,
  Query,
  Repository,
  Scalars,
  Tree,
  TreeEntry,
} from "@octokit/graphql-schema";
import { Octokit } from "octokit";
import path from "path";
import { GitHubOperationsContext } from "../../types.js";
import {
  assertIsBlob,
  assertIsRepository,
  assertIsTree,
  isBlob,
  isCommit,
  isTree,
  loadQuery,
} from "../graphql-util.js";

export class GithubAPIData {
  readonly logParams: { [key: string]: JsonValue };
  readonly externalRepoId: string;
  private readonly ctx: LogContext;
  private readonly octokit: Octokit;

  private __memo__latestCommitOnDefaultBranch?: Commit | null;
  private __memo__expressRootDirs?: string[];
  private __memo__externalGithubRepo?: Repository;

  /**
   * Constructs a new instance of the GitHubOperations class.
   *
   * @param {object} params - An object containing the necessary parameters.
   * @param {object} params.ctx - The context object.
   * @param {object} params.octokit - The Octokit object.
   * @param {string} params.externalRepoId - The external repository ID.
   */
  constructor({
    ctx,
    octokit,
    externalRepoId,
  }: GitHubOperationsContext & { externalRepoId: string }) {
    this.ctx = ctx;
    this.octokit = octokit;
    this.externalRepoId = externalRepoId;

    this.logParams = {};
  }

  /**
   * Retrieves an external GitHub repository using the repository's node ID.
   * The repository is fetched via a GraphQL query and memoized for future use.
   * If the repository has been previously fetched, the memoized version is returned.
   * The function also logs the repository's ID and name with owner for tracking purposes.
   *
   * @returns {Promise<Repository>} A promise that resolves to the fetched GitHub repository.
   * @throws {AssertionError} If the fetched node is not a repository.
   */
  async getExternalGithubRepo(): Promise<Repository> {
    if (this.__memo__externalGithubRepo !== undefined) {
      return this.__memo__externalGithubRepo;
    }

    const query = await loadQuery("getRepo");
    const variables: {
      nodeId: Scalars["ID"]["input"];
    } = {
      nodeId: this.externalRepoId,
    };

    const response = await this.octokit.graphql<{ node: Query["node"] }>(
      query,
      variables,
    );

    const externalGithubRepo = response.node;
    assertIsRepository(externalGithubRepo);

    this.logParams["external_github_repo"] = {
      id: externalGithubRepo.id,
      nameWithOwner: externalGithubRepo.nameWithOwner,
    };
    this.__memo__externalGithubRepo = externalGithubRepo;
    return this.__memo__externalGithubRepo;
  }

  /**
   * Asynchronously retrieves the root directories of Express applications within the project.
   * It searches for 'package.json' files containing the term '"express":' to identify Express applications.
   * The results are memoized for future calls.
   * If no Express application directories are found, a warning is logged.
   * @returns {Promise<string[]>} A promise that resolves to an array of root directory paths for Express applications.
   */
  async getExpressRootDirs(): Promise<string[]> {
    if (this.__memo__expressRootDirs !== undefined) {
      return this.__memo__expressRootDirs;
    }

    const expressRootDirs: string[] = [];

    for await (const treeEntry of this.recurseGitTree({
      treeRootDir: "",
    })) {
      /**
       * Use `match` here to cover all common ways that Express may be defined as a dependency.
       * For example, "express" can be defined in `dependencies`, `devDependencies`, or `peerDependencies`.
       * Instead of parsing package.json and checking each of those (and potentially missing something), we'll just do a dumb regex search.
       */
      if (
        treeEntry.name === "package.json" &&
        isBlob(treeEntry.object) &&
        treeEntry.object.text &&
        /"express":/.test(treeEntry.object.text)
      ) {
        assertPresence(treeEntry.path);

        // path.dirname behaves differently depending on the input:
        // - path.dirname("path/to/file.txt") == "path/to"
        // - path.dirname("file.txt") == "."
        // For git expressions, paths never start with ".", so we strip it out here.
        let dirname = path.dirname(treeEntry.path);
        dirname = dirname.replace(/^\.\/?/, "");
        expressRootDirs.push(dirname);
      }
    }

    if (expressRootDirs.length === 0) {
      eaveLogger.warning(
        "No express API dir file found",
        this.logParams,
        this.ctx,
      );
    }

    this.logParams["express_root_dirs"] = expressRootDirs;
    this.__memo__expressRootDirs = expressRootDirs;
    return expressRootDirs;
  }

  /**
   * Retrieves the latest commit on the default branch of the external Github repository.
   * If the latest commit is already memoized, it returns the memoized commit.
   * Otherwise, it queries the Github GraphQL API to fetch the latest commit.
   * If the fetched object is not a commit, it returns null.
   * The fetched commit is memoized for future use.
   *
   * @returns {Promise<Commit | null>} The latest commit on the default branch or null if not found.
   * @async
   */
  async getLatestCommitOnDefaultBranch(): Promise<Commit | null> {
    if (this.__memo__latestCommitOnDefaultBranch !== undefined) {
      return this.__memo__latestCommitOnDefaultBranch;
    }

    const externalGithubRepo = await this.getExternalGithubRepo();
    const query = await loadQuery("getGitObject");
    const variables: {
      repoOwner: Scalars["String"]["input"];
      repoName: Scalars["String"]["input"];
      expression: Scalars["String"]["input"];
    } = {
      repoOwner: externalGithubRepo.owner.login,
      repoName: externalGithubRepo.name,
      expression: "HEAD", // default branch by default
    };

    const response = await this.octokit.graphql<{
      repository: Query["repository"];
    }>(query, variables);

    assertIsRepository(response.repository);
    if (!isCommit(response.repository.object)) {
      return null;
    }

    let latestCommitOnDefaultBranch: Commit | null;
    if (isCommit(response.repository.object)) {
      latestCommitOnDefaultBranch = response.repository.object;
    } else {
      latestCommitOnDefaultBranch = null;
    }

    this.__memo__latestCommitOnDefaultBranch = latestCommitOnDefaultBranch;
    return latestCommitOnDefaultBranch;
  }

  /**
   * Retrieves the Git tree of a specified directory from an external GitHub repository.
   *
   * @param {Object} params - An object containing the root directory of the tree.
   * @param {string} params.treeRootDir - The root directory of the tree.
   *
   * @returns {Promise<Tree>} A promise that resolves to the Git tree of the specified directory.
   *
   * @throws {AssertionError} If the response from the GitHub API does not contain a valid repository or tree.
   */
  async getGitTree({ treeRootDir }: { treeRootDir: string }): Promise<Tree> {
    const externalGithubRepo = await this.getExternalGithubRepo();
    const query = await loadQuery("getGitObject");
    const variables: {
      repoOwner: Scalars["String"]["input"];
      repoName: Scalars["String"]["input"];
      expression: Scalars["String"]["input"];
    } = {
      repoOwner: externalGithubRepo.owner.login,
      repoName: externalGithubRepo.name,
      expression: `${externalGithubRepo.defaultBranchRef!.name}:${treeRootDir}`,
    };

    const response = await this.octokit.graphql<{
      repository: Query["repository"];
    }>(query, variables);

    assertIsRepository(response.repository);
    const repository = response.repository;

    assertIsTree(repository.object);
    const tree = repository.object;

    return tree;
  }

  /**
   * Asynchronously generates `TreeEntry` objects by recursively traversing a Git tree.
   * The function uses Breadth-First Search (BFS) to traverse the tree.
   *
   * @param treeRootDir - The root directory of the Git tree to be traversed.
   * @yields {TreeEntry} - Yields blob entries first, then recursively yields entries from subtrees.
   *
   * @remarks
   * The function is designed to yield `TreeEntry` objects where `TreeEntry.object.__typename === "Blob"`.
   * The caller is responsible for asserting this condition.
   */
  async *recurseGitTree({
    treeRootDir,
  }: {
    treeRootDir: string;
  }): AsyncGenerator<TreeEntry> {
    const gitTree = await this.getGitTree({ treeRootDir });
    const blobEntries = gitTree.entries?.filter((e) => isBlob(e.object));
    const subTrees = gitTree.entries?.filter((e) => isTree(e.object));

    // BFS
    if (blobEntries) {
      for (const blobEntry of blobEntries) {
        // TODO: How to design this function to return a TreeEntry narrowed to `TreeEntry.object.__typename === "Blob"`, so the caller doesn't have to assert?
        yield blobEntry;
      }
    }

    if (subTrees) {
      for (const subTree of subTrees) {
        assertPresence(subTree.path);
        yield* this.recurseGitTree({ treeRootDir: subTree.path });
      }
    }
  }

  /**
   * Retrieves the content of a file from a GitHub repository.
   *
   * @param {Object} params - The parameters for the function.
   * @param {string} params.filePath - The path of the file in the repository.
   *
   * @returns {Promise<Blob | null>} The content of the file as a Blob if it exists, otherwise null.
   *
   * @throws {Error} If the response from the GitHub API does not contain a valid repository or Blob.
   */
  async getFileContent({
    filePath,
  }: {
    filePath: string;
  }): Promise<Blob | null> {
    const externalGithubRepo = await this.getExternalGithubRepo();
    const query = await loadQuery("getGitObject");
    const variables: {
      repoOwner: Scalars["String"]["input"];
      repoName: Scalars["String"]["input"];
      expression: Scalars["String"]["input"];
    } = {
      repoOwner: externalGithubRepo.owner.login,
      repoName: externalGithubRepo.name,
      expression: `${
        externalGithubRepo.defaultBranchRef?.name || "main"
      }:${filePath}`,
    };

    const response = await this.octokit.graphql<{
      repository: Query["repository"];
    }>(query, variables);

    assertIsRepository(response.repository);
    const repository = response.repository;

    if (!repository.object) {
      return null;
    }

    assertIsBlob(repository.object);
    return repository.object;
  }
}
