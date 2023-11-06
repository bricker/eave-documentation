import { makeStyles } from "@material-ui/styles";
import React from "react";

import AuthModal from "../../AuthModal/index.jsx";
import Footer from "../../Footer/index.jsx";
import Header from "../../Header/index.jsx";

const makeClasses = makeStyles((theme) => ({
  container: {
    backgroundColor: theme.palette.background.main,
    fontFamily: theme.typography.fontFamily,
    position: "relative",
    minHeight: "100vh",
    zIndex: 1, // this keeps the hero bg image behind the nav bar
  },
  sections: {
    minHeight: `calc(100vh - ${theme.header.height}px - ${theme.header.marginBottom}px - ${theme.footer.height}px)`,
    [theme.breakpoints.up("md")]: {
      minHeight: `calc(100vh - ${theme.header.md.height}px - ${theme.header.md.marginBottom}px - ${theme.footer.height}px)`,
    },
  },
}));

const Page = ({
  children = undefined,
  simpleHeader = false,
  footer = true,
  compactHeader = false,
}) => {
  const classes = makeClasses();
  return (
    <div className={classes.container}>
      <Header simpleHeader={simpleHeader} compactHeader={compactHeader} />
      <div className={classes.sections}>{children}</div>
      {footer && <Footer />}
      <AuthModal />
    </div>
  );
};

export default Page;
