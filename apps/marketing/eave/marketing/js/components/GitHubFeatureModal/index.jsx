// @ts-check
import { Dialog, IconButton, Typography } from "@material-ui/core";
import { makeStyles } from "@material-ui/styles";
import classNames from "classnames";
import React, { useCallback, useEffect, useState } from "react";
import { useCookies } from "react-cookie";
import * as Types from "../../types"; // eslint-disable-line no-unused-vars

import useTeam from "../../hooks/useTeam.js";
import { imageUrl } from "../../util/asset-util.js";
import Button from "../Button/index.jsx";
import GitHubRepoSelect from "../GitHubRepoSelect/index.jsx";
import CloseIcon from "../Icons/CloseIcon.js";
import ExpandIcon from "../Icons/ExpandIcon.jsx";
import InfoTooltip from "../InfoTooltip/index.jsx";

import {
  FEATURE_MODAL,
  FEATURE_STATES,
  FEEDBACK_URL,
} from "../../constants.js";

const makeClasses = makeStyles((/** @type {Types.Theme} */ theme) => ({
  paper: {
    backgroundColor: theme.palette.background["main"],
    color: theme.palette.background["contrastText"],
    width: "100%",
    height: "100%",
    maxHeight: "none",
    maxWidth: 762,
    margin: 0,
    padding: "88px 25px",
    overflowY: "scroll",
    [theme.breakpoints.up("md")]: {
      backgroundColor: theme.palette.background["light"],
      height: "auto",
      padding: "60px 54px 44px",
      overflowY: "visible",
    },
  },
  confirmationPaper: {
    [theme.breakpoints.up("md")]: {
      padding: "146px 96px 64px",
    },
  },
  closeButton: {
    position: "absolute",
    top: 10,
    right: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: 400,
    marginBottom: 14,
    [theme.breakpoints.up("md")]: {
      textAlign: "center",
      marginBottom: 18,
      fontSize: 36,
    },
  },
  githubRequirement: {
    display: "flex",
    alignItems: "center",
    marginBottom: 14,
    [theme.breakpoints.up("md")]: {
      flexDirection: "column",
      marginBottom: 30,
    },
  },
  requiredText: {
    marginRight: 10,
    fontSize: 16,
    [theme.breakpoints.up("md")]: {
      fontSize: 18,
      marginRight: 0,
    },
  },
  githubLogo: {
    width: 144,
    [theme.breakpoints.up("md")]: {
      width: 200,
    },
  },
  githubWarning: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 25,
    color: theme.palette.error.main,
    [theme.breakpoints.up("md")]: {
      fontSize: 18,
      marginBottom: 36,
    },
  },
  description: {
    fontSize: 18,
    fontWeight: 400,
    marginBottom: 10,
    "& > div": {
      margin: "0 0 30px",
      "& > ul": {
        margin: 0,
      },
      [theme.breakpoints.up("md")]: {
        margin: "0 0 32px",
      },
    },
    [theme.breakpoints.up("md")]: {
      marginBottom: 0,
    },
  },
  ctaBtnContainer: {
    [theme.breakpoints.up("md")]: {
      display: "flex",
      justifyContent: "flex-end",
    },
  },
  ctaBtn: {
    width: "100%",
    fontSize: 20,
    marginTop: 20,
    [theme.breakpoints.up("md")]: {
      width: "auto",
      minWidth: 200,
      marginTop: 0,
    },
  },
  githubReposText: {
    display: "flex",
    alignItems: "center",
    fontSize: 18,
  },
  disabledText: {
    color: "#808182",
  },
  tooltip: {
    marginLeft: 4,
  },
  selectedReposLabel: {
    display: "inline-block",
    marginLeft: 4,
    fontWeight: 700,
  },
  expandBtnContainer: {
    marginTop: 8,
  },
  expandBtn: {
    width: "auto",
    height: "auto",
    padding: 0,
    color: "#0092C7",
    fontSize: 14,
    "&:hover": {
      backgroundColor: "transparent",
    },
  },
  selectText: {
    fontSize: 14,
    margin: "11px 0 5px",
  },
  turnOffBtn: {
    color: theme.palette.error.main,
    textDecoration: "underline",
    fontSize: 16,
    fontWeight: 700,
    position: "absolute",
    left: 25,
    top: 25,
    width: "auto",
    height: "auto",
    padding: 0,
    "&:hover": {
      backgroundColor: "transparent",
      textDecoration: "underline",
    },
    [theme.breakpoints.up("md")]: {
      fontSize: 14,
      left: 31,
      top: 22,
    },
  },
  confirmationBtns: {
    marginTop: 42,
    "& > button": {
      width: "100%",
    },
    [theme.breakpoints.up("md")]: {
      display: "flex",
      justifyContent: "center",
      "& > button": {
        width: 250,
      },
    },
  },
  disableBtn: {
    border: `1px solid ${theme.palette.background["contrastText"]}`,
    color: theme.palette.background["contrastText"],
    fontSize: 20,
    width: "100%",
    marginBottom: 10,
    "&:hover": {
      border: `1px solid ${theme.palette.background["contrastText"]}`,
      backgroundColor: "transparent",
    },
    [theme.breakpoints.up("md")]: {
      marginBottom: 0,
      marginRight: 15,
      width: "auto",
    },
  },
  feedbackLinkContainer: {
    marginTop: 90,
    textAlign: "center",
    [theme.breakpoints.up("md")]: {
      marginTop: 140,
    },
  },
  feedbackLink: {
    color: "#0092C7",
    fontSize: 16,
    fontWeight: 400,
  },
}));

/**
 * Returns the title for a given feature modal type.
 *
 * @param {string} type - The type of the feature modal.
 * @returns {string} The title corresponding to the feature modal type. Returns an empty string for unknown types.
 */
function renderTitle(type) {
  switch (type) {
    case FEATURE_MODAL.TYPES.INLINE_CODE_DOCS:
      return "Inline Code Documentation";
    case FEATURE_MODAL.TYPES.API_DOCS:
      return "API Documentation Automation";
    default:
      return "";
  }
}

/**
 * Renders the description for a given feature type.
 *
 * @param {string} type - The type of the feature for which the description is to be rendered.
 *
 * There are two types of features:
 * 1. FEATURE_MODAL.TYPES.INLINE_CODE_DOCS: Renders a description about automating inline code documentation within GitHub files.
 * 2. FEATURE_MODAL.TYPES.API_DOCS: Renders a description about automating standard industry API documentation.
 *
 * @returns {JSX.Element|null} The description for the given feature type or null if the feature type is not recognized.
 */
function renderDescription(type) {
  switch (type) {
    case FEATURE_MODAL.TYPES.INLINE_CODE_DOCS:
      return (
        <>
          <div>
            Automate inline code documentation within your GitHub files.
          </div>
          <div>
            As changes are made to the codebase, Eave will automatically
            generate inline documentation via a pull request for your team's
            review.
          </div>
        </>
      );
    case FEATURE_MODAL.TYPES.API_DOCS:
      return (
        <>
          <div>
            Automate standard industry API documentation to streamline your
            internal processes and delight your customers.
          </div>
          <div>
            Currently supports Express REST APIs written in:
            <ul>
              <li>JavaScript</li>
              <li>TypeScript</li>
            </ul>
          </div>
        </>
      );
    default:
      return null;
  }
}

const GitHubFeatureModal = (
  /** @type {{ onClose: () => void, onUpdate: (p: Types.FeatureStateParams) => void, open: boolean, feature: string, type: string }}*/ {
    onClose,
    onUpdate,
    open,
    feature,
    type,
  },
) => {
  const classes = makeClasses();
  const [_, setCookie] = useCookies([FEATURE_MODAL.ID]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [optionsExpanded, setOptionsExpanded] = useState(false);

  /** @type {[string | null, React.Dispatch<React.SetStateAction<string | null>>]} */
  const [selectedRepoError, setSelectedRepoError] = useState(null);
  const { team } = useTeam();

  const github = team?.integrations?.github_integration;

  /** @type {Types.GlobalEave} */
  // @ts-ignore
  const _globalEave = window;

  const githubOauthUrl = `${_globalEave.eave.apiBase}/oauth/github/authorize`;
  const githubLogoFile = github
    ? "eave-github-installed.png"
    : "eave-github-required.png";
  const githubReposClass = classNames(
    classes.githubReposText,
    !github && classes.disabledText,
  );

  const teamRepoIds = team?.repos?.map((repo) => repo.id) || [];
  const enabledRepos =
    team?.repos?.filter((repo) => repo[feature] === FEATURE_STATES.ENABLED) ||
    [];
  const notEnabledRepos =
    team?.repos?.filter((repo) => repo[feature] !== FEATURE_STATES.ENABLED) ||
    [];
  const sortedRepos = [...enabledRepos, ...notEnabledRepos];

  const enabledRepoIds = enabledRepos.map((r) => r.id);
  const featureIsEnabled = !!enabledRepoIds.length;
  const cta = featureIsEnabled ? "Update" : "Turn On";
  const [selectedRepoIds, setSelectedRepoIds] = useState(
    featureIsEnabled ? enabledRepoIds : teamRepoIds,
  );
  const selectedAll = selectedRepoIds.length === teamRepoIds.length;
  const [selectedReposLabel, setSelectedReposLabel] = useState(
    selectedAll ? "Default" : "Custom",
  );

  useEffect(() => {
    // once `team` finishes loading from network, update default selection
    setSelectedRepoIds(featureIsEnabled ? enabledRepoIds : teamRepoIds);
  }, [team]);

  const toggleExpandOptions = useCallback(() => {
    setOptionsExpanded(!optionsExpanded);
  }, [optionsExpanded]);

  const openConfirmation = useCallback(() => {
    setShowConfirmation(true);
  }, []);

  const closeConfirmation = useCallback(() => {
    setShowConfirmation(false);
  }, []);

  const handleUpdate = useCallback(() => {
    onUpdate({
      teamRepoIds,
      enabledRepoIds: selectedRepoIds,
      feature,
    });
  }, [team?.id, teamRepoIds, selectedRepoIds]);

  const handleDisable = useCallback(() => {
    onUpdate({
      teamRepoIds,
      enabledRepoIds: [],
      feature,
    });
  }, [team?.id, teamRepoIds]);

  const setModalCookie = useCallback(() => {
    setCookie(FEATURE_MODAL.ID, type);
  }, []);

  const handleSelectRepo = useCallback(
    (val) => {
      const error =
        "At least one repository must be selected to turn on this feature.";
      if (val === "default") {
        // Case 1: All repos are already selected and user selects "default".
        if (selectedRepoIds.length === teamRepoIds.length) {
          setSelectedRepoIds([]);
          setSelectedReposLabel("Custom");
          setSelectedRepoError(error);
          return;
        }
        // Case 2: One or more repos are not selected and use selects "default".
        setSelectedRepoIds(teamRepoIds);
        setSelectedReposLabel("Default");
        setSelectedRepoError(null);
        return;
      }
      // Case 3: The user is deselecting a repo.
      if (selectedRepoIds.includes(val)) {
        const newSelectedRepoIds = selectedRepoIds.filter((id) => id !== val);
        setSelectedRepoIds(newSelectedRepoIds);
        setSelectedReposLabel("Custom");
        if (!newSelectedRepoIds.length) {
          setSelectedRepoError(error);
        }
        return;
      }
      // Case 4: The user is reselecting a repo.
      setSelectedRepoIds([...selectedRepoIds, val]);
      setSelectedRepoError(null);
      if (selectedRepoIds.length + 1 === teamRepoIds.length) {
        setSelectedReposLabel("Default");
      }
    },
    [selectedRepoIds, teamRepoIds],
  );

  if (showConfirmation) {
    return (
      <Dialog
        classes={{
          paper: classNames(classes.paper, classes.confirmationPaper),
        }}
        onClose={onClose}
        open={open}
      >
        <IconButton className={classes.closeButton} onClick={onClose}>
          {/*@ts-ignore*/}
          <CloseIcon />
        </IconButton>
        <Typography className={classes.title} variant="h2">
          Are you sure you want to turn off {renderTitle(type)}?
        </Typography>
        <div className={classes.description}>
          Eave will stop automatically updating these documents once this
          feature is turned off. Updates will need to be made manually.
        </div>
        <div className={classes.confirmationBtns}>
          <Button
            onClick={handleDisable}
            className={classes.disableBtn}
            variant="outlined"
          >
            Yes, I'll Manually Update
          </Button>
          <Button
            onClick={closeConfirmation}
            className={classes.ctaBtn}
            color="secondary"
          >
            No, Keep Automation
          </Button>
        </div>
        <div className={classes.feedbackLinkContainer}>
          <a
            className={classes.feedbackLink}
            href={FEEDBACK_URL}
            target="_blank"
            rel="noreferrer"
          >
            Send Feedback
          </a>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog classes={{ paper: classes.paper }} onClose={onClose} open={open}>
      {featureIsEnabled && (
        <Button
          className={classes.turnOffBtn}
          onClick={openConfirmation}
          variant="text"
          disableRipple
        >
          Turn Off
        </Button>
      )}
      <IconButton className={classes.closeButton} onClick={onClose}>
        {/*@ts-ignore*/}
        <CloseIcon />
      </IconButton>
      <Typography className={classes.title} variant="h2">
        {renderTitle(type)}
      </Typography>
      <div className={classes.githubRequirement}>
        <Typography className={classes.requiredText}>
          Required for setup:
        </Typography>
        <img className={classes.githubLogo} src={imageUrl(githubLogoFile)} />
      </div>
      {!github && (
        <Typography className={classes.githubWarning}>
          This feature requires a GitHub integration. In order to proceed,
          please add the Eave app to your GitHub account by clicking on the
          button below.
        </Typography>
      )}
      <div className={classes.description}>{renderDescription(type)}</div>
      <div className={githubReposClass}>
        Selected Repositories:{" "}
        <span className={classes.selectedReposLabel}>{selectedReposLabel}</span>
        <InfoTooltip className={classes.tooltip} disabled={!github}>
          <p>
            By default, this feature will access all repositories provided to
            the Eave for GitHub app.
          </p>
          <p>
            To select a custom subset of repos, click “Advanced Options”, or to
            update what Eave for GitHub can access, go to the app settings in
            your GitHub account (settings/apps/eave-fyi/permissions).
          </p>
        </InfoTooltip>
      </div>
      {github && (
        <div className={classes.expandBtnContainer}>
          <Button
            className={classes.expandBtn}
            onClick={toggleExpandOptions}
            variant="text"
            disableRipple
          >
            Advanced Options <ExpandIcon up={optionsExpanded} color="#0092C7" />
          </Button>
        </div>
      )}
      <div style={{ visibility: optionsExpanded ? "visible" : "hidden" }}>
        <Typography className={classes.selectText}>
          Select Individual Repositories
        </Typography>
        <GitHubRepoSelect
          repos={sortedRepos}
          selectedRepoIds={selectedRepoIds}
          error={selectedRepoError}
          onSelect={handleSelectRepo}
        />
      </div>
      <div className={classes.ctaBtnContainer}>
        {github ? (
          <Button
            onClick={handleUpdate}
            className={classes.ctaBtn}
            disabled={!!selectedRepoError}
            color="secondary"
          >
            {cta}
          </Button>
        ) : (
          <Button
            to={githubOauthUrl}
            onClick={setModalCookie}
            className={classes.ctaBtn}
            color="secondary"
          >
            Add App
          </Button>
        )}
      </div>
    </Dialog>
  );
};

export default GitHubFeatureModal;
