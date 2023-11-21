// @ts-check
import { Checkbox, FormControlLabel, FormGroup } from "@material-ui/core";
import { makeStyles } from "@material-ui/styles";
import * as Types from "../../types"; // eslint-disable-line no-unused-vars
import classNames from "classnames";
import React, { useCallback, useState } from "react";

import Button from "../Button/index.jsx";
import ExpandIcon from "../Icons/ExpandIcon.jsx";

const makeClasses = makeStyles((/** @type {Types.Theme} */ theme) => ({
  outerContainer: {
    position: "relative",
    [theme.breakpoints.up("md")]: {
      height: 40,
    },
  },
  innerContainer: {
    color: theme.palette.background["contrastText"],
    border: `1px solid ${theme.palette.background["contrastText"]}`,
    backgroundColor: theme.palette.background["main"],
    zIndex: 10,
    width: "100%",
    padding: "0 14px",
    borderRadius: 5,
    fontSize: 14,
    maxHeight: 168,
    overflowY: "scroll",
    [theme.breakpoints.up("md")]: {
      backgroundColor: theme.palette.background["light"],
      position: "absolute",
      width: 300,
      maxHeight: 256,
    },
  },
  innerContainerError: {
    border: `1px solid ${theme.palette.error.main}`,
    color: theme.palette.error.main,
  },
  expandBtn: {
    color: "inherit",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    height: 40,
    padding: 0,
    "&:hover": {
      backgroundColor: "transparent",
    },
  },
  checkbox: {
    color: "#808182",
  },
  errorContainer: {
    color: theme.palette.error.main,
    marginBottom: 5,
  },
  formLabels: {
    color: theme.palette.background["contrastText"],
  },
}));

const GitHubRepoSelect = (
  /** @type {{repos: Types.GithubRepo[], selectedRepoIds: string[], onSelect: function, error: any}} */ {
    repos,
    selectedRepoIds,
    onSelect,
    error,
  },
) => {
  const classes = makeClasses();
  const [reposExpanded, setReposExpanded] = useState(false);
  const innerContainerClass = classNames(
    classes.innerContainer,
    error && classes.innerContainerError,
  );
  const label =
    repos.length === selectedRepoIds.length ? "Default (All)" : "Custom";

  const toggleExpandRepos = useCallback(() => {
    setReposExpanded(!reposExpanded);
  }, [reposExpanded]);

  const handleSelect = (event) => {
    onSelect(event.target.value);
  };

  return (
    <>
      {error && <div className={classes.errorContainer}>{error}</div>}
      <div className={classes.outerContainer}>
        <div className={innerContainerClass}>
          <Button
            className={classes.expandBtn}
            onClick={toggleExpandRepos}
            variant="text"
            disableRipple
          >
            {label}{" "}
            <ExpandIcon
              up={reposExpanded}
              color={error ? "#E03C6C" : "white"}
              lg
            />
          </Button>
          {reposExpanded && (
            <FormGroup>
              <FormControlLabel
                value="default"
                label="Default (All)"
                classes={{ root: classes.formLabels }}
                onChange={handleSelect}
                control={
                  <Checkbox
                    classes={{ root: classes.checkbox }}
                    checked={repos.length === selectedRepoIds.length}
                  />
                }
              />
              {repos.map((repo) => (
                <FormControlLabel
                  key={repo.id}
                  value={repo.id}
                  label={
                    repo["external_repo_data"]?.name || "Github Repository"
                  }
                  classes={{ root: classes.formLabels }}
                  onChange={handleSelect}
                  control={
                    <Checkbox
                      classes={{ root: classes.checkbox }}
                      checked={selectedRepoIds.includes(repo.id)}
                    />
                  }
                />
              ))}
            </FormGroup>
          )}
        </div>
      </div>
    </>
  );
};

export default GitHubRepoSelect;
