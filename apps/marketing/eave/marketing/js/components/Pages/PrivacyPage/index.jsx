import { makeStyles } from "@material-ui/styles";
import React from "react";

import Copy from "../../Copy/index.jsx";
import Page from "../Page/index.jsx";

const makeClasses = makeStyles((theme) => ({
  main: {
    position: "relative",
    padding: "54px 40px",
    [theme.breakpoints.up("md")]: {
      padding: "54px 164px",
    },
  },
  title: {
    marginBottom: 26,
    [theme.breakpoints.up("sm")]: {
      maxWidth: 850,
    },
  },
  para: {
    marginBottom: 26,
  },
  link: {
    color: "inherit",
    textDecoration: "none",
  },
}));

const PrivacyPage = () => {
  const classes = makeClasses();

  return (
    <Page simpleHeader={true}>
      <main className={classes.main}>
        <Copy className={classes.title} variant="h1">
          Privacy Policy
        </Copy>
        <Copy className={classes.para}>
          Eave Technologies, Inc. ("Eave", "we", "us", or "our") is committed to
          protecting the privacy of our customers and users of our products and
          services ("you" or "your"). This Privacy Policy explains how we
          collect, use, and disclose information that we obtain from you when
          you use our products and services.
        </Copy>
        <Copy className={classes.para}>Information We Collect</Copy>
        <Copy className={classes.para}>
          We may collect information from you when you use our products and
          services, including your name, email address, phone number, and other
          contact information. We may also collect information about your
          device, such as IP address, operating system, and browser type.
        </Copy>
        <Copy className={classes.para}>
          We may also collect information about your usage of our products and
          services, such as the pages you visit, the features you use, and the
          content you view.
        </Copy>
        <Copy className={classes.para}>How We Use Your Information</Copy>
        <Copy className={classes.para}>
          We use personal information to provide and improve our product and
          services, communicate with our users, and personalize their
          experience. Specifically, we may use your information to:
        </Copy>
        <ul>
          <li>
            <Copy>Process payments</Copy>
          </li>
          <li>
            <Copy>Respond to customer inquiries and support requests</Copy>
          </li>
          <li>
            <Copy>Analyze usage trends and improve our services</Copy>
          </li>
          <li>
            <Copy>
              Send promotional emails and other marketing communications
            </Copy>
          </li>
          <li>
            <Copy>Comply with legal obligations and protect our rights</Copy>
          </li>
        </ul>
        <Copy className={classes.para}>Information Sharing and Disclosure</Copy>
        <Copy className={classes.para}>
          We do not sell or rent personal information to third parties. However,
          we may share your information with trusted third-party service
          providers who assist us in delivering our services, such as payment
          processors and email marketing platforms. We may also disclose
          personal information if required by law or to protect our legal
          rights.
        </Copy>
        <Copy className={classes.para}>Data Security</Copy>
        <Copy className={classes.para}>
          We take reasonable measures to protect personal information from
          unauthorized access, disclosure, and misuse. This includes using
          encryption and other security technologies to protect sensitive data,
          as well as limiting access to personal information to authorized
          personnel only. However, no security measures are perfect or
          impenetrable, and we cannot guarantee the security of your
          information.
        </Copy>
        <Copy className={classes.para}>Your Rights and Choices</Copy>
        <Copy className={classes.para}>
          You have the right to access, correct, or delete your personal
          information at any time. You may also opt-out of receiving marketing
          communications from us by following the instructions in our emails.
          Please note that we may still send you transactional or
          service-related messages even if you opt-out of marketing
          communications.
        </Copy>

        <Copy className={classes.para}>Changes to this Privacy Policy</Copy>
        <Copy className={classes.para}>
          We may update this privacy policy from time to time to reflect changes
          in our practices or legal requirements. We will notify you of any
          changes by posting the updated Privacy Policy on our website.
        </Copy>
        <Copy className={classes.para}>Contact Us</Copy>
        <Copy>
          If you have any questions or concerns about this privacy policy or our
          data practices, please contact us at{" "}
          <a className={classes.link} href="mailto:info@eave.fyi">
            info@eave.fyi
          </a>
        </Copy>
      </main>
    </Page>
  );
};

export default PrivacyPage;
