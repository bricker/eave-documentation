// @ts-check
import * as Types from "../types.js"; // eslint-disable-line no-unused-vars

/** @returns {{[key: string] : Types.GithubRepo}} */
export function mapReposById(/** @type {Types.GithubRepo[]} */ repoList) {
  /** @type {{[key: string] : Types.GithubRepo}} */
  const repoMap = {};
  for (const repo of repoList) {
    const externalId = repo.id;
    repoMap[externalId] = repo;
  }
  return repoMap;
}
