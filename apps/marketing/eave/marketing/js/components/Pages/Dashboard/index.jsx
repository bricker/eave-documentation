// @ts-check
import React, { useEffect, useState } from "react";
import { useCookies } from "react-cookie";
import { useSearchParams } from "react-router-dom";
import useTeam from "../../../hooks/useTeam.js";
import * as Types from "../../../types.js"; // eslint-disable-line no-unused-vars

import APIDocumentation from "../../APIDocumentation/index.jsx";
import ExploreFeatures from "../../ExploreFeatures/index.jsx";
import FeatureSettings from "../../FeatureSettings/index.jsx";
import GitHubFeatureModal from "../../GitHubFeatureModal/index.jsx";
import ErrorPage from "../ErrorPage/index.jsx";
import LoadingPage from "../LoadingPage/index.jsx";
import Page from "../Page/index.jsx";

import { FEATURE_MODAL, FEATURE_STATE_PROPERTY } from "../../../constants.js";

const Dashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [cookies, _, removeCookie] = useCookies([FEATURE_MODAL.ID]);
  const { team, getTeam, getTeamRepos, updateTeamFeatureState } = useTeam();
  const [inlineDocsModalIsOpen, setInlineDocsModalIsOpen] = useState(false);
  const [apiDocsModalIsOpen, setAPIDocsModalIsOpen] = useState(false);

  const showFeatureSettings = team.inlineCodeDocsEnabled || team.apiDocsEnabled;
  const showAPIDocs = team.apiDocsEnabled;

  const isLoading = team.teamIsLoading || team.reposAreLoading;

  const isErroring = team.teamIsErroring;

  const dashboardRequestsSucceededAtLeastOnce =
    team.teamRequestHasSucceededAtLeastOnce &&
    team.apiDocsRequestHasSucceededAtLeastOnce &&
    team.reposRequestHasSucceededAtLeastOnce;

  const closeModal = () => {
    removeCookie(FEATURE_MODAL.ID);
    setSearchParams({});
    if (inlineDocsModalIsOpen) {
      setInlineDocsModalIsOpen(false);
      return;
    }
    if (apiDocsModalIsOpen) {
      setAPIDocsModalIsOpen(false);
    }
  };

  const openInlineDocsModal = () => {
    if (inlineDocsModalIsOpen) {
      return;
    }
    setSearchParams({
      [FEATURE_MODAL.ID]: FEATURE_MODAL.TYPES.INLINE_CODE_DOCS,
    });
    setInlineDocsModalIsOpen(true);
  };

  const openAPIDocsModal = () => {
    if (apiDocsModalIsOpen) {
      return;
    }
    setSearchParams({ [FEATURE_MODAL.ID]: FEATURE_MODAL.TYPES.API_DOCS });
    setAPIDocsModalIsOpen(true);
  };

  const handleFeatureUpdate = (
    /**@type {Types.FeatureStateParams}*/ {
      teamRepoIds,
      enabledRepoIds,
      feature,
    },
  ) => {
    updateTeamFeatureState({ teamRepoIds, enabledRepoIds, feature });
    closeModal();
  };

  useEffect(() => {
    getTeam();
    getTeamRepos();
  }, []);

  useEffect(() => {
    const featureModal = cookies && cookies[FEATURE_MODAL.ID];
    switch (featureModal) {
      case FEATURE_MODAL.TYPES.INLINE_CODE_DOCS:
        openInlineDocsModal();
        break;
      case FEATURE_MODAL.TYPES.API_DOCS:
        openAPIDocsModal();
        break;
      default:
        break;
    }
  }, [cookies]);

  useEffect(() => {
    const featureParam = searchParams.get(FEATURE_MODAL.ID);
    switch (featureParam) {
      case FEATURE_MODAL.TYPES.INLINE_CODE_DOCS:
        openInlineDocsModal();
        break;
      case FEATURE_MODAL.TYPES.API_DOCS:
        openAPIDocsModal();
        break;
      default:
        break;
    }
  }, [searchParams]);

  if (isErroring && !dashboardRequestsSucceededAtLeastOnce) {
    return <ErrorPage page="dashboard" />;
  }
  if (isLoading && !dashboardRequestsSucceededAtLeastOnce) {
    return <LoadingPage />;
  }
  return (
    <Page>
      {showAPIDocs && <APIDocumentation />}
      <ExploreFeatures
        onInlineDocsClick={openInlineDocsModal}
        onAPIDocsClick={openAPIDocsModal}
      />
      {showFeatureSettings && (
        <FeatureSettings
          onInlineDocsClick={openInlineDocsModal}
          onAPIDocsClick={openAPIDocsModal}
        />
      )}
      {inlineDocsModalIsOpen && (
        <GitHubFeatureModal
          feature={FEATURE_STATE_PROPERTY.INLINE_CODE_DOCS}
          type={FEATURE_MODAL.TYPES.INLINE_CODE_DOCS}
          onClose={closeModal}
          onUpdate={handleFeatureUpdate}
          open={inlineDocsModalIsOpen}
        />
      )}
      {apiDocsModalIsOpen && (
        <GitHubFeatureModal
          feature={FEATURE_STATE_PROPERTY.API_DOCS}
          type={FEATURE_MODAL.TYPES.API_DOCS}
          onClose={closeModal}
          onUpdate={handleFeatureUpdate}
          open={apiDocsModalIsOpen}
        />
      )}
    </Page>
  );
};

export default Dashboard;
