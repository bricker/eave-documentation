// @ts-check
import { Typography } from "@material-ui/core";
import { makeStyles } from "@material-ui/styles";
import React from "react";
import * as Types from "../../../types.js"; // eslint-disable-line no-unused-vars
import { imageUrl } from "../../../util/asset-util.js";
import Button from "../../Button/index.jsx";
import GoogleIcon from "../../Icons/GoogleIcon.jsx";
import Page from "../Page/index.jsx";

const makeClasses = makeStyles((/** @type {Types.Theme} */ theme) => ({
  container: {
    // @ts-ignore
    color: theme.palette.background.contrastText,
    display: "flex",
    justifyContent: "flex-start",
    alignItems: "center",
    flexDirection: "column",
    padding: "0px 25px 20px",
    [theme.breakpoints.up("sm")]: {
      padding: "0px 60px 20px",
    },
  },
  logo: {
    height: 120,
    marginBottom: 18,
    [theme.breakpoints.down("sm")]: {
      marginBottom: 24,
      height: 100,
    },
  },
  header: {
    color: "inherit",
    fontSize: 32,
    fontWeight: 700,
    marginBottom: 12,
    textAlign: "center",
    [theme.breakpoints.up("md")]: {
      fontSize: 42,
    },
  },
  subheader: {
    marginBottom: 36,
    textAlign: "center",
    color: "inherit",
    fontSize: 16,
    [theme.breakpoints.up("md")]: {
      fontSize: 18,
    },
  },
  loginButton: {
    // @ts-ignore
    color: theme.palette.background.contrastText,
    // @ts-ignore
    borderColor: theme.palette.background.contrastText,
    width: "100%",
    padding: "34px 54px",
    marginBottom: 54,
    justifyContent: "center",
    "&:hover": {
      // @ts-ignore
      borderColor: theme.palette.background.contrastText,
      // @ts-ignore
      backgroundColor: theme.palette.background.light,
    },
    fontSize: 16,
    [theme.breakpoints.up("md")]: {
      fontSize: 20,
    },
  },
  authIcon: {
    width: 30,
    height: 30,
  },
  link: {
    color: "#0092C7",
  },
  disclaimer: {
    // @ts-ignore
    color: theme.palette.background.contrastText,
    marginBottom: 60,
    display: "grid",
    textAlign: "center",
    maxWidth: 400,
    "& > a": {
      // @ts-ignore
      color: theme.palette.background.contrastText,
    },
    fontSize: 16,
    [theme.breakpoints.up("md")]: {
      fontSize: 18,
    },
  },
  authSwap: {
    color: "inherit",
    fontWeight: 700,
    fontSize: 16,
    [theme.breakpoints.up("md")]: {
      fontSize: 18,
    },
  },
}));

const AuthenticationPage = ({ /** @type {"signup" | "login"} */ type }) => {
  const classes = makeClasses();
  // if isLoginMode is false, then we are in sign up mode
  /** @type {boolean} */
  const isLoginMode = type === "login";
  return (
    <Page simpleHeader={true} footer={false} compactHeader={true}>
      <section className={classes.container}>
        <img
          className={classes.logo}
          src={imageUrl("eave-logo-round-3x.png")}
        />
        <Typography variant="h2" className={classes.header}>
          {isLoginMode ? "Log In" : "Create your Free Account"}
        </Typography>
        <Typography variant="subtitle2" className={classes.subheader}>
          {isLoginMode
            ? "Welcome back to Eave!"
            : "Early access is only available via Google. Additional account options coming soon."}
        </Typography>
        <Button
          // @ts-ignore
          to={`${window.eave.apiBase}/oauth/google/authorize`}
          className={classes.loginButton}
          variant="outlined"
          startIcon={<GoogleIcon className={classes.authIcon} />}
        >
          Continue with Google
        </Button>
        <Typography className={classes.disclaimer} variant="caption">
          {!isLoginMode && (
            <Typography variant="inherit">
              By clicking “Continue” you agree to Eave's
            </Typography>
          )}
          <Typography variant="inherit">
            <a
              className={classes.link}
              href="/terms"
              rel="noreferrer"
              target="_blank"
            >
              TOS
            </a>{" "}
            and{" "}
            <a
              className={classes.link}
              href="/privacy"
              rel="noreferrer"
              target="_blank"
            >
              Privacy Policy.
            </a>
          </Typography>
        </Typography>
        <Typography className={classes.authSwap} variant="caption">
          {isLoginMode ? "New to Eave? " : "Already have an account? "}
          <a className={classes.link} href={isLoginMode ? "/signup" : "/login"}>
            {isLoginMode ? "Create a free account" : "Log in"}
          </a>
        </Typography>
      </section>
    </Page>
  );
};

export default AuthenticationPage;
