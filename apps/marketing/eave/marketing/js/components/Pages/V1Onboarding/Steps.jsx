// @ts-check
import React, { useContext, useEffect, useState } from 'react';
import { makeStyles } from '@material-ui/styles';
import {
  StepContent,
  StepLabel,
  Step,
  Stepper,
  Select,
  FormControl,
  MenuItem,
  useMediaQuery,
  CircularProgress,
  InputLabel,
} from '@material-ui/core';
import classNames from 'classnames';

import { INTEGRATION_LOGOS } from '../../../constants.js';
import Copy from '../../Copy/index.jsx';
import Button from '../../Button/index.jsx';
import PurpleCheckIcon from '../../Icons/PurpleCheckIcon.jsx';
import ConfluenceIcon from '../../Icons/ConfluenceIcon.jsx';
import AtlassianIcon from '../../Icons/AtlassianIcon.jsx';
import DownIcon from '../../Icons/DownIcon.js';
import Footnote from './Footnote.jsx';
import StepIcon from './StepIcon.jsx';
import * as Types from "../../../types.js"; // eslint-disable-line no-unused-vars
import useTeam from '../../../hooks/useTeam.js';
import { AppContext } from '../../../context/Provider.js';

const makeClasses = makeStyles((/** @type {Types.Theme} */ theme) => ({
  main: {
    position: 'relative',
    padding: `calc(66px + 54px) 40px 0`,
    [theme.breakpoints.up('md')]: {
      padding: '164px',
    },
  },
  copy: {
    maxWidth: 838,
  },
  button: {
    marginTop: 12,
    width: 150,
    [theme.breakpoints.up('md')]: {
      width: 166,
    },
  },
  header: {
    marginBottom: 0,
  },
  clickable: {
    cursor: 'pointer',
  },
  downIcon: {
    marginLeft: 16,
    width: 16,
  },
  content: {
    marginLeft: 16,
    paddingLeft: 18,
    marginTop: 0,
    [theme.breakpoints.up('md')]: {
      marginLeft: 22,
      paddingLeft: 27,
    },
  },
  stepper: {
    padding: 0,
    '& .MuiStepConnector-vertical': {
      marginLeft: 16,
      [theme.breakpoints.up('md')]: {
        marginLeft: 22,
      },
    },
    '& .MuiStepLabel-vertical': {
      marginBottom: 22,
      marginTop: 22,
    },
    '& .MuiStepLabel-completed $header': {
      // @ts-ignore
      color: theme.typography.color.innactive,
    },
    '& .MuiStepLabel-completed svg': {
      opacity: 0.7,
    },
  },
  selectWrapper: {
    display: 'flex',
    flexDirection: 'column',
    [theme.breakpoints.up('sm')]: {
      flexDirection: 'row',
    },
  },
  select: {
    width: 275,
    marginTop: 12,
    [theme.breakpoints.up('sm')]: {
      width: 418,
    },
  },
  error: {
    color: 'red',
    marginTop: 12,
  },
  submit: {
    width: 275,
    height: 56,
    marginTop: 12,
    [theme.breakpoints.up('sm')]: {
      width: 166,
      marginLeft: 30,
    },
  },
  connectButton: {
    width: 166,
    // @ts-ignore
    color: theme.typography.color.dark,
    marginTop: 22,
    marginRight: 20,
    // @ts-ignore
    border: `1px solid ${theme.typography.color.dark}`,
    height: 60,
    position: 'relative',
  },
  connected: {
    position: 'absolute',
    top: 5,
    left: 5,
    width: 14,
  },
  atlassian: {
    width: 95,
    [theme.breakpoints.up('sm')]: {
      width: 144,
    },
  },
  githubButtonLogo: {
    maxWidth: 116,
  },
  slackButtonLogo: {
    maxWidth: 88,
  },
  jiraButtonLogo: {
    maxWidth: 128,
  },
  completed: {
    opacity: 0.5,
  },
}));

const JIRA_APP_INSTALL_URL = 'https://marketplace.atlassian.com/apps/1231329/eave-for-jira';
const CONFLUENCE_APP_INSTALL_URL = 'https://marketplace.atlassian.com/apps/1231330/eave-for-confluence';

const Steps = () => {
  const classes = makeClasses();
  const isDesktop = useMediaQuery((/** @type {Types.Theme} */ theme) => theme.breakpoints.up('md'));

  /** @type {import("../../../context/Provider.js").AppContextProps} */
  const { dashboardNetworkStateCtx: [networkState] } = useContext(AppContext);

  const {
    confluenceSpacesLoading,
    confluenceSpaceUpdateLoading,
    confluenceSpaceUpdateErroring,
    teamIsLoading,
  } = networkState;

  const {
    listAvailableConfluenceSpaces,
    setConfluenceSpace,
    getTeam,
    team,
  } = useTeam();

  useEffect(() => {
    getTeam();
  }, []);

  if (teamIsLoading) {
    return <CircularProgress></CircularProgress>
  }

  const [step, setStep] = useState(2);
  const [space, setSpace] = useState(team?.confluenceDestination?.space_key || '');
  const [editingSpace, setEditingSpace] = useState(false);
  const [didClickForgeButton, setDidClickForgeButton] = useState(false);
  const [didClickJiraButton, setDidClickJiraButton] = useState(false);
  const [didClickSlackButton, setDidClickSlackButton] = useState(false);

    /** @type {Types.GlobalEave} */
  // @ts-ignore
  const _globalEave = window;

  useEffect(() => {
    if (!team?.integrations?.confluence_integration && !didClickForgeButton) {
      setStep(0);
      return;
    }

    if (!team?.integrations?.confluence_integration) {
      setStep(1);
      return;
    }

    // if user has not selected a confluence space
    if (!confluenceSpaceUpdateLoading && (!team?.confluenceDestination?.space_key || editingSpace || confluenceSpaceUpdateErroring)) {
      if (!confluenceSpacesLoading && team?.availableConfluenceSpaces === undefined) {
        listAvailableConfluenceSpaces();
      }
      setStep(2);
      return;
    }

    // if user has not linked their github, slack, or jira
    if (!team?.integrations?.github_integration || !team?.integrations?.slack_integration || !team?.integrations?.jira_integration) {
      setStep(3);
      return;
    }

    // user has linked all so we can just show a completed stepper
    setStep(4);
  }, [team, confluenceSpaceUpdateLoading, didClickForgeButton, editingSpace, confluenceSpaceUpdateErroring]);

  const isStep3Clickable = step > 2;

  const handleForgeButtonClick = () => {
    setDidClickForgeButton(true);
  };

  const handleJiraButtonClick = () => {
    setDidClickJiraButton(true);
  };

  const handleSlackButtonClick = () => {
    setDidClickSlackButton(true);
  };

  const handleSpaceUpdate = () => {
    setEditingSpace(false);
    setConfluenceSpace({ space_key: space });
  };

  const handleSelectChange = (event) => {
    setSpace(event.target.value);
  };

  const handleStepClick = () => {
    if (isStep3Clickable) {
      setEditingSpace(true);
    }
  };

  return (
    <section>
      <Copy variant="h1">Welcome to Eave Early Access</Copy>
      <Copy className={classes.copy}>You’re on your way to better documentation. To get started using Eave, complete the below steps.</Copy>
      <Stepper
        orientation="vertical"
        activeStep={step}
        classes={{ vertical: classes.stepper }}>
        <Step>
          <StepLabel StepIconComponent={StepIcon}>
            <Copy variant="h3" className={classes.header}>
              Step 1: Add Eave to <AtlassianIcon className={classes.atlassian} />
            </Copy>
          </StepLabel>
          <StepContent className={classes.content}>
            <Copy variant="pSmall">Add Eave, and then come back to this page to complete setup.</Copy>
            <Button
              lg
              className={classes.button}
              onClick={() => handleForgeButtonClick()}
              target="_blank"
              href={CONFLUENCE_APP_INSTALL_URL}
            >
              Add App
            </Button>
          </StepContent>
        </Step>
        <Step>
          <StepLabel StepIconComponent={StepIcon}>
            <Copy variant="h3" className={classes.header}>
              {isDesktop ? (
                <span>
                  Step 2: Connect to your <ConfluenceIcon /> Confluence Account
                </span>
              ) : (
                <span>
                  Step 2: Connect to <ConfluenceIcon /> Confluence
                </span>
              )}

            </Copy>
          </StepLabel>
          <StepContent className={classes.content}>
            <Copy variant="pSmall">This will allow Eave to automatically generate documentation in Confluence.</Copy>
            <Button lg className={classes.button} to={`${_globalEave.eave.apiBase}/oauth/atlassian/authorize`}>
              Connect
            </Button>
          </StepContent>
        </Step>
        <Step>
          <StepLabel StepIconComponent={StepIcon} onClick={handleStepClick}>
            <Copy variant="h3" className={classNames(classes.header, { [classes.clickable]: isStep3Clickable })} >
              Step 3: Select your <ConfluenceIcon /> Confluence Space
              {isStep3Clickable && (
                confluenceSpaceUpdateLoading
                  ? <CircularProgress className={classes.downIcon} size={16} thickness={2} />
                  : <DownIcon className={classes.downIcon} />
              )}
            </Copy>
          </StepLabel>
          <StepContent className={classes.content}>
            <Copy variant="pSmall">This will allow Eave to automatically generate documentation in Confluence.</Copy>
            <div className={classes.selectWrapper}>
              <FormControl variant='outlined' className={classes.select}>
                {confluenceSpacesLoading ? <CircularProgress /> : (
                  <>
                    {!space && <InputLabel id="space-selector-label">Select your Confluence Space</InputLabel>}
                    <Select
                      labelId="space-selector-label"
                      id="space-selector"
                      value={space}
                      onChange={handleSelectChange}
                      disabled={confluenceSpaceUpdateLoading}
                    >
                      {team?.availableConfluenceSpaces?.map((spc) => {
                        return (
                          <MenuItem value={spc.key} key={spc.key}>{spc.name}</MenuItem>
                        );
                      })}
                    </Select>
                  </>
                )}
              </FormControl>
              <Button
                  className={classes.submit}
                  onClick={handleSpaceUpdate}
                  disabled={confluenceSpaceUpdateLoading || confluenceSpacesLoading}
                >
                  {confluenceSpaceUpdateLoading ? <CircularProgress /> : 'Submit'}
                </Button>
            </div>
            {confluenceSpaceUpdateErroring && (
              <Copy variant="footnote" className={classes.error}>Something went wrong setting the Confluence space, please try again</Copy>
            )}
          </StepContent>
        </Step>
        <Step>
          <StepLabel StepIconComponent={StepIcon}>
            <Copy variant="h3" className={classes.header}>Step 4: Integrate your business tools</Copy>
          </StepLabel>
          <StepContent className={classes.content}>
            <Copy variant="pSmall" className={classes.copy}>Select the tools where Eave can pull information from and be tagged to created documentation. Note Jira is automatically granted permissions via the Confluence connection.</Copy>
            <Button
              className={classes.connectButton}
              variant="outlined"
              startIcon={team?.integrations?.github_integration && <PurpleCheckIcon className={classes.connected} />}
              disabled={!!team?.integrations?.github_integration}
              to={`${_globalEave.eave.apiBase}/oauth/github/authorize`}
              lg
            >
              <img
                className={classNames(classes.githubButtonLogo, { [classes.completed]: team?.integrations?.github_integration })}
                src={INTEGRATION_LOGOS.githubInline.src}
                alt={INTEGRATION_LOGOS.githubInline.alt}
              />
            </Button>
            <Button
              className={classes.connectButton}
              variant="outlined"
              startIcon={(team?.integrations?.slack_integration || didClickSlackButton) && <PurpleCheckIcon className={classes.connected} />}
              disabled={!!team?.integrations?.slack_integration}
              to={`${_globalEave.eave.apiBase}/oauth/slack/authorize`}
              target="_blank"
              onClick={() => handleSlackButtonClick()}
              lg
            >
              <img
                className={classNames(classes.slackButtonLogo, { [classes.completed]: team?.integrations?.slack_integration || didClickSlackButton })}
                src={INTEGRATION_LOGOS.slack.src}
                alt={INTEGRATION_LOGOS.slack.alt}
              />
            </Button>
            <Button
              className={classes.connectButton}
              variant="outlined"
              startIcon={(team?.integrations?.jira_integration || didClickJiraButton) && <PurpleCheckIcon className={classes.connected} />}
              disabled={!!team?.integrations?.jira_integration}
              to={JIRA_APP_INSTALL_URL}
              target="_blank"
              onClick={() => handleJiraButtonClick()}
              lg
            >
              <img
                className={classNames(classes.jiraButtonLogo, { [classes.completed]: team?.integrations?.jira_integration || didClickJiraButton })}
                src={INTEGRATION_LOGOS.jira.src}
                alt={INTEGRATION_LOGOS.jira.alt}
              />
            </Button>
          </StepContent>
        </Step>
      </Stepper>
      <Footnote />
    </section>
  );
};

export default Steps;
