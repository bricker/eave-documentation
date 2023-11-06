/**
 * @typedef {import("@material-ui/core").Theme} Theme
 */

/**
 * @typedef {Window & typeof globalThis & { eave: { cookieDomain: string, apiBase: string, assetBase: string } }} GlobalEave
 */

/**
 * @typedef {import("../../../../../libs/eave-stdlib-ts/src/core-api/models/github-repos.js").GithubRepo} GithubRepo
 */

/**
 * @typedef {import("../../../../../libs/eave-stdlib-ts/src/core-api/operations/github-repos.js").GetGithubReposResponseBody} GetGithubReposResponseBody
 */

/**
 * @typedef {import("../../../../../libs/eave-stdlib-ts/src/core-api/operations/github-repos.js").UpdateGithubReposRequestBody} UpdateGithubReposRequestBody
 */

/**
 * @typedef {import("../../../../../libs/eave-stdlib-ts/src/core-api/models/github-repos.js").GithubRepoUpdateInput} GithubRepoUpdateInput
 */

/**
 * @typedef {import("../../../../../libs/eave-stdlib-ts/src/core-api/operations/github-documents.js").GetGithubDocumentsResponseBody} GetGithubDocumentsResponseBody
 */

/**
 * @typedef {import("../../../../../libs/eave-stdlib-ts/src/core-api/models/github-documents.js").GithubDocument} GithubDocument
 */

/**
 * @typedef {import("../../../../../libs/eave-stdlib-ts/src/core-api/models/team.js").Team} Team
 */

/**
 * @typedef {import("../../../../../libs/eave-stdlib-ts/src/core-api/models/account.js").AuthenticatedAccount} AuthenticatedAccount
 */

/**
 * @typedef {import("../../../../../libs/eave-stdlib-ts/src/core-api/models/integrations.js").Integrations} Integrations
 */

/**
 * @typedef {import("../../../../../libs/eave-stdlib-ts/src/core-api/operations/team.js").GetTeamResponseBody} GetTeamResponseBody
 */

/**
 * @typedef {object} DashboardTeam
 * @property {boolean} [teamIsLoading]
 * @property {boolean} [teamIsErroring]
 * @property {boolean} [reposAreLoading]
 * @property {boolean} [reposAreErroring]
 * @property {boolean} [apiDocsLoading]
 * @property {boolean} [apiDocsErroring]
 * @property {number} [apiDocsFetchCount]
 * @property {boolean} [teamRequestHasSucceededAtLeastOnce]
 * @property {boolean} [reposRequestHasSucceededAtLeastOnce]
 * @property {boolean} [apiDocsRequestHasSucceededAtLeastOnce]
 * @property {boolean} [inlineCodeDocsEnabled]
 * @property {boolean} [apiDocsEnabled]
 * @property {string} [id]
 * @property {string} [name]
 * @property {GithubDocument[]} [apiDocs]
 * @property {Integrations} [integrations]
 * @property {GithubRepo[]} [repos]
 */

/**
 * @typedef {object} DashboardUser
 * @property {boolean} [accountIsLoading]
 * @property {boolean} [accountIsErroring]
 * @property {AuthenticatedAccount} [account]
 */

/** @typedef {{ teamRepoIds: string[], enabledRepoIds: string[], feature: string }} FeatureStateParams */

export const Types = {};
