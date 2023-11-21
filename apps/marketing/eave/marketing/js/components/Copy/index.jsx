import { makeStyles } from "@material-ui/styles";
import classNames from "classnames";
import React from "react";

/**
 * TODO: Deprecate this component in favor of MUI's Typography Component.
 * Reference: https://mui.com/material-ui/api/typography/
 */
const makeClasses = makeStyles((theme) => ({
  h1: {
    color: theme.palette.background.contrastText,
    fontSize: 36,
    lineHeight: "47px",
    fontWeight: 700,
    margin: 0,
    [theme.breakpoints.up("sm")]: {
      fontSize: 54,
      lineHeight: "70px",
    },
  },
  h2: {
    color: theme.palette.background.contrastText,
    fontSize: 24,
    lineHeight: "31px",
    fontWeight: 400,
    margin: "0 0 12px",
    [theme.breakpoints.up("sm")]: {
      fontSize: 32,
      lineHeight: "42px",
    },
  },
  h3: {
    color: theme.palette.background.contrastText,
    fontSize: 16,
    lineHeight: "20px",
    fontWeight: 400,
    margin: "0 0 12px",
    [theme.breakpoints.up("sm")]: {
      fontSize: 24,
      lineHeight: "31px",
    },
  },
  footnote: {
    color: theme.palette.background.contrastText,
    fontSize: 14,
    lineHeight: "18px",
    margin: 0,
    [theme.breakpoints.up("sm")]: {
      fontSize: 16,
      lineHeight: "21px",
    },
  },
  pSmall: {
    color: theme.palette.background.contrastText,
    fontWeight: 400,
    margin: 0,
    fontSize: 18,
    lineHeight: "23px",
  },
  p: {
    color: theme.palette.background.contrastText,
    fontWeight: 400,
    margin: 0,
    fontSize: 24,
    lineHeight: "31px",
  },
  bold: {
    fontWeight: "bold",
  },
}));

const Copy = (/** @type {{ children: any, className?: string, variant?: string, bold?: boolean} */ { children, className, variant, bold = false }) => {
  const classes = makeClasses();
  const h1Class = classNames(classes.h1, bold && classes.bold, className);
  const h2Class = classNames(classes.h2, bold && classes.bold, className);
  const h3Class = classNames(classes.h3, bold && classes.bold, className);
  const footnoteClass = classNames(
    classes.footnote,
    bold && classes.bold,
    className,
  );
  const pSmallClass = classNames(
    classes.pSmall,
    bold && classes.bold,
    className,
  );
  const pClass = classNames(classes.p, bold && classes.bold, className);
  let element;

  switch (variant) {
    case "h1":
      element = <h1 className={h1Class}>{children}</h1>;
      break;
    case "h2":
      element = <h2 className={h2Class}>{children}</h2>;
      break;
    case "h3":
      element = <h3 className={h3Class}>{children}</h3>;
      break;
    case "footnote":
      element = <p className={footnoteClass}>{children}</p>;
      break;
    case "pSmall":
      element = <p className={pSmallClass}>{children}</p>;
      break;
    default:
      element = <p className={pClass}>{children}</p>;
      break;
  }

  return element;
};

export default Copy;
