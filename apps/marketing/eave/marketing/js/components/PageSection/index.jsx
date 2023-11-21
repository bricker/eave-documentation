import { makeStyles } from "@material-ui/styles";
import classNames from "classnames";
import React from "react";

const makeClasses = makeStyles((theme) => ({
  section: {
    position: "relative",
    padding: "54px 20px",
    [theme.breakpoints.up("md")]: {
      padding: "54px 40px",
    },
    [theme.breakpoints.up("lg")]: {
      padding: "72px 40px",
    },
  },
  wrapper: {
    maxWidth: 1115,
    margin: "0 auto",
  },
}));

const PageSection = (/** @type {{ children: any, alternateBackground?: string, sectionClassName?: string, wrapperClassName?: string, id?: string }} */ {
  children,
  alternateBackground,
  sectionClassName,
  wrapperClassName,
  id,
}) => {
  const classes = makeClasses();
  const sectionClasslist = classNames(
    classes.section,
    alternateBackground && classes.alternateBackground,
    sectionClassName,
  );

  const wrapperClassList = classNames(classes.wrapper, wrapperClassName);

  return (
    <section className={sectionClasslist} id={id}>
      <div className={wrapperClassList}>{children}</div>
    </section>
  );
};

export default PageSection;
