// @ts-check
import React from 'react';
import { makeStyles } from '@material-ui/styles';

import PurpleCheckIcon from '../../Icons/PurpleCheckIcon.jsx';
import * as Types from "../../../types.js"; // eslint-disable-line no-unused-vars

const makeClasses = makeStyles((/** @type {Types.Theme} */ theme) => ({
  step: {
    width: 25,
    height: 25,
    border: '1px solid black',
    borderRadius: '50%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    [theme.breakpoints.up('md')]: {
      width: 39,
      height: 39,
    },
  },
  purpleCheck: {
    width: 23,
    height: 23,
    [theme.breakpoints.up('md')]: {
      width: 27,
      height: 27,
    },
  },
}));

const StepIcon = (props) => {
  const classes = makeClasses();

  return (
    <div className={classes.step}>
      {props.completed && <PurpleCheckIcon className={classes.purpleCheck} />}
    </div>
  );
};

export default StepIcon;
