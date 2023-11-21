// @ts-check
import { CssBaseline, ThemeProvider } from "@material-ui/core";
import React from "react";
import { CookiesProvider, withCookies } from "react-cookie";
import { Helmet } from "react-helmet";
import {
  Navigate,
  Route,
  BrowserRouter as Router,
  Routes,
} from "react-router-dom";

import "../static/css/app.css";
import AuthenticationPage from "./components/Pages/AuthenticationPage/index.jsx";
import Dashboard from "./components/Pages/Dashboard/index.jsx";
import V1Onboarding from "./components/Pages/V1Onboarding/index.jsx";
import HomePage from "./components/Pages/HomePage/index.jsx";
import PrivacyPage from "./components/Pages/PrivacyPage/index.jsx";
import TermsPage from "./components/Pages/TermsPage/index.jsx";
import PrivateRoutes from "./components/PrivateRoutes/index.jsx";
import ScrollToTop from "./components/ScrollToTop/index.jsx";
import AppStoreProvider from "./context/Provider.js";
import { theme } from "./theme.js";

const App = () => {
  return (
    <CookiesProvider>
      <AppStoreProvider>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {/* @ts-ignore */}
          <Helmet>
            <title>Eave - for your information.</title>
          </Helmet>
          <Router>
            <ScrollToTop />
            <Routes>
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route
                path="/signup"
                element={<AuthenticationPage type="signup" />}
              />
              <Route
                path="/login"
                element={<AuthenticationPage type="login" />}
              />
              <Route element={<PrivateRoutes />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/v1-onboarding" element={<V1Onboarding />} />
              </Route>
              <Route path="/" element={<HomePage />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Router>
        </ThemeProvider>
      </AppStoreProvider>
    </CookiesProvider>
  );
};

export default withCookies(App);
