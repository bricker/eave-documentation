// @ts-check
import { useContext } from "react";
import { DOC_TYPES, FEATURE_STATES } from "../constants.js";
import { AppContext } from "../context/Provider.js";
import * as Types from "../types.js"; // eslint-disable-line no-unused-vars
import { sortAPIDocuments } from "../util/document-util.js";
import { isHTTPError, isUnauthorized, logUserOut } from "../util/http-util.js";

/** @returns {{team: Types.DashboardTeam, getTeam: any, getTeamRepos: any, getTeamAPIDocs: any, updateTeamFeatureState: any}} */
const useTeam = () => {
  const { teamCtx } = useContext(AppContext);
  /** @type {[Types.DashboardTeam, (f: (prev: Types.DashboardTeam) => Types.DashboardTeam) => void]} */
  const [team, setTeam] = teamCtx;

  /**
   * Asynchronously fetches team data from the "/dashboard/team" endpoint using a POST request.
   * Updates the team state with the fetched data, including team ID, name, and integrations.
   * Handles HTTP errors by setting the 'teamIsErroring' state to true.
   * Regardless of success or failure, sets 'teamIsLoading' state to false upon completion.
   */
  function getTeam() {
    setTeam((prev) => ({
      ...prev,
      teamIsLoading: true,
      teamIsErroring: false,
    }));
    fetch("/dashboard/team", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    })
      .then((resp) => {
        if (isUnauthorized(resp)) {
          logUserOut();
          return;
        }
        if (isHTTPError(resp)) {
          throw resp;
        }
        return resp
          .json()
          .then((/** @type {Types.GetTeamResponseBody} */ data) => {
            setTeam((prev) => ({
              ...prev,
              teamIsLoading: false,
              teamRequestHasSucceededAtLeastOnce: true, // continue to show the table even if a subsequent request failed.
              id: data.team?.id,
              name: data.team?.name,
              integrations: data.integrations,
            }));
          });
      })
      .catch(() => {
        setTeam((prev) => ({
          ...prev,
          teamIsLoading: false,
          teamIsErroring: true,
        }));
      });
  }

  /**
   * Asynchronously fetches the team's repositories from the server and updates the team state accordingly.
   * If the request is successful, the team's repositories are updated and a flag is set to indicate a successful request.
   * If the request fails, an error flag is set.
   * Regardless of the request outcome, the loading flag is reset at the end.
   */
  function getTeamRepos() {
    setTeam((prev) => ({
      ...prev,
      reposAreLoading: true,
      reposAreErroring: false,
    }));
    fetch("/dashboard/team/repos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    })
      .then((resp) => {
        if (isUnauthorized(resp)) {
          logUserOut();
          return;
        }

        if (isHTTPError(resp)) {
          throw resp;
        }
        return resp
          .json()
          .then((/** @type {Types.GetGithubReposResponseBody} */ data) => {
            setTeam((prev) => ({
              ...prev,
              reposAreLoading: false,
              reposRequestHasSucceededAtLeastOnce: true, // continue to show the table even if a subsequent request failed.
              repos: data.repos,
              inlineCodeDocsEnabled: data.repos.some(
                (repo) =>
                  repo.inline_code_documentation_state ===
                  FEATURE_STATES.ENABLED,
              ),
              apiDocsEnabled: data.repos.some(
                (repo) =>
                  repo.api_documentation_state === FEATURE_STATES.ENABLED,
              ),
            }));
          });
      })
      .catch(() => {
        setTeam((prev) => ({
          ...prev,
          reposAreLoading: false,
          reposAreErroring: true,
        }));
      });
  }

  /**
   * Asynchronously updates the state of a feature for a team's repositories.
   * It sets the feature state to either enabled or disabled based on the provided parameters.
   * It also handles the loading and error states during the update process.
   *
   * @async
   * @function updateTeamFeatureState
   * @param {object} params - An object containing the parameters for the feature state update.
   * @param {string[]} params.teamRepoIds - An array of repository IDs associated with the team.
   * @param {string[]} params.enabledRepoIds - An array of repository IDs where the feature is enabled.
   * @param {string} params.feature - The feature to update the state for.
   * @throws {HTTPError} If the HTTP request fails.
   */
  function updateTeamFeatureState(
    /** @type {Types.FeatureStateParams} */ {
      teamRepoIds,
      enabledRepoIds,
      feature,
    },
  ) {
    /** @type {Types.GithubRepoUpdateInput[]} */
    const repos = teamRepoIds.map(
      /** @type {(repoId: string) => Types.GithubRepoUpdateInput} */ (
        repoId,
      ) => {
        const state = enabledRepoIds.includes(repoId)
          ? FEATURE_STATES.ENABLED
          : FEATURE_STATES.DISABLED;

        return {
          id: repoId,
          new_values: {
            [feature]: state,
          },
        };
      },
    );
    fetch("/dashboard/team/repos/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ repos }),
    })
      .then((resp) => {
        if (isUnauthorized(resp)) {
          logUserOut();
          return;
        }
        if (isHTTPError(resp)) {
          throw resp;
        }
        // Currently there is no UI to handle a success or loading state for this operation.
        getTeamRepos();
      })
      .catch(() => {
        // Currently there is no UI to handle a failure state for this operation.
      });
  }

  /**
   * Asynchronously fetches API documentation from the server and updates the team state accordingly.
   * The state is initially set to loading, then updated with the fetched documents if the request is successful.
   * If the request fails, the state is updated to reflect the error.
   * Regardless of success or failure, the fetch count is incremented and the loading state is reset at the end.
   * The documents are sorted before being set in the state.
   * The state also keeps track of whether a request has succeeded at least once to continue showing the table even if a subsequent request fails.
   */
  function getTeamAPIDocs() {
    setTeam((prev) => ({
      ...prev,
      apiDocsLoading: true,
      apiDocsErroring: false,
    }));
    fetch("/dashboard/team/documents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ document_type: DOC_TYPES.API_DOC }),
    })
      .then((resp) => {
        if (isUnauthorized(resp)) {
          logUserOut();
          return;
        }
        if (isHTTPError(resp)) {
          throw resp;
        }
        return resp
          .json()
          .then((/**@type {Types.GetGithubDocumentsResponseBody}*/ data) => {
            setTeam((prev) => ({
              ...prev,
              apiDocsLoading: false,
              apiDocsFetchCount: prev.apiDocsFetchCount + 1,
              apiDocsRequestHasSucceededAtLeastOnce: true, // continue to show the table even if a subsequent request failed.
              apiDocs: sortAPIDocuments(data.documents),
            }));
          });
      })
      .catch(() => {
        setTeam((prev) => ({
          ...prev,
          apiDocsLoading: false,
          apiDocsFetchCount: prev.apiDocsFetchCount + 1,
          apiDocsErroring: true,
        }));
      });
  }

  return {
    team,
    getTeam,
    getTeamRepos,
    getTeamAPIDocs,
    updateTeamFeatureState,
  };
};

export default useTeam;
