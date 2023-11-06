// @ts-check
import React, { createContext, useState } from "react";
import { AUTH_MODAL_STATE } from "../constants.js";

export const AppContext = createContext(null);

const AppContextProvider = ({ children }) => {
  const [authModal, setAuthModal] = useState({
    isOpen: false,
    mode: AUTH_MODAL_STATE.SIGNUP,
  });

  const [user, setUser] = useState({
    account: {},
    accountIsLoading: true,
    accountIsErroring: false,
  });

  const [team, setTeam] = useState({
    teamIsLoading: true,
    teamIsErroring: false,
    reposAreLoading: true,
    reposAreErroring: false,
    apiDocsLoading: true,
    apiDocsErroring: false,
    apiDocsFetchCount: 0,
    teamRequestHasSucceededAtLeastOnce: false,
    reposRequestHasSucceededAtLeastOnce: false,
    apiDocsRequestHasSucceededAtLeastOnce: false,
    inlineCodeDocsEnabled: false,
    apiDocsEnabled: false,
    id: {},
    name: "",
    apiDocs: [],
    integrations: {},
    repos: [],
  });

  const ctx = {
    authModalCtx: [authModal, setAuthModal],
    userCtx: [user, setUser],
    teamCtx: [team, setTeam],
  };

  return <AppContext.Provider value={ctx}>{children}</AppContext.Provider>;
};

export default AppContextProvider;
