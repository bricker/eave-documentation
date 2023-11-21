// @ts-check
import React from 'react';
import { makeStyles } from '@material-ui/styles';

import { FEEDBACK_URL } from '../../../constants.js';
import Copy from '../../Copy/index.jsx';
import ChatboxIcon from '../../Icons/ChatboxIcon.jsx';
import * as Types from "../../../types.js"; // eslint-disable-line no-unused-vars

const makeClasses = makeStyles((/** @type {Types.Theme} */ theme) => ({
  footer: {
    maxWidth: 883,
    padding: '26px 34px',
    marginTop: 28,
    marginBottom: 24,
    // @ts-ignore
    backgroundColor: theme.palette.background.secondary,
    display: 'flex',
    [theme.breakpoints.up('md')]: {
      padding: 24,
      marginTop: 92,
    },
  },
  chatIcon: {
    paddingRight: 28,
    display: 'none',
    [theme.breakpoints.up('md')]: {
      display: 'block',
    },
  },
}));

const Footnote = () => {
  const classes = makeClasses();
  return (
    <section className={classes.footer}>
      <div className={classes.chatIcon}>
        <ChatboxIcon />
      </div>
      <div>
        <Copy variant="footnote" bold>A Message from the Eave Team</Copy>
        <Copy variant="footnote">
          Please note we’re currently in development and have many more integrations on the way. We’d love to hear your feedback on the current experience as well as any requests you may have. You can fill out this feedback form <a href={FEEDBACK_URL} rel='noreferrer' target='_blank'>here</a>, or reach out to us directly at <a href="mailto:info@eave.fyi">info@eave.fyi</a>
        </Copy>
        </div>
    </section>
  );
};

export default Footnote;
