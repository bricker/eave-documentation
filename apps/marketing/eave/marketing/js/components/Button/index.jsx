// @ts-check
import { Button as MaterialButton } from "@material-ui/core";
import { makeStyles } from "@material-ui/styles";
import classNames from "classnames";
import React from "react";
import { Link } from "react-router-dom";

const makeClasses = makeStyles(() => ({
  root: {
    minWidth: 172,
    minHeight: 50,
    textTransform: "none",
    borderRadius: "10px",
    fontSize: 16,
  },
  disabled: {
    backgroundColor: "#808182 !important",
    color: "#FFFFFF !important",
  },
  link: {
    textDecoration: "none",
  },
}));

const Button = (/** @type {{ children: any, className: string, to?: string, target?: string, color?: import("@material-ui/core").PropTypes.Color, variant?: "text" | "outlined" | "contained", [key:string]: any }} */{
  children,
  className,
  to,
  target,
  color = "primary",
  variant = "contained",
  ...rest
}) => {
  const classes = makeClasses();
  const rootClass = classNames(classes.root, className);

  const button = (
    <MaterialButton
      classes={{
        root: rootClass,
        disabled: classes.disabled,
      }}
      color={color}
      variant={variant}
      {...rest}
    >
      {children}
    </MaterialButton>
  );

  if (to) {
    return (
      <Link className={classes.link} to={to} target={target}>
        {button}
      </Link>
    );
  }

  return button;
};

export default Button;
