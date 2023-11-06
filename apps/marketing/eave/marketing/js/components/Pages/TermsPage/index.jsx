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

const TermsPage = () => {
  const classes = makeClasses();

  return (
    <Page simpleHeader>
      <main className={classes.main}>
        <Copy className={classes.title} variant="h1">
          Terms of Service
        </Copy>
        <Copy className={classes.para}>
          These Terms of Service ("Terms") govern your use of our website,
          products, and services (collectively, the "Services"). By using our
          Services, you agree to these Terms.
        </Copy>
        <Copy className={classes.para}>Use of Services</Copy>
        <Copy className={classes.para}>
          You may use our Services only for lawful purposes and in accordance
          with these Terms. You agree not to use our Services:
        </Copy>
        <ul>
          <li>
            <Copy>
              In any way that violates any applicable federal, state, local, or
              international law or regulation.
            </Copy>
          </li>
          <li>
            <Copy>
              To engage in any activity that interferes with or disrupts our
              Services (or the servers and networks that are connected to our
              Services).
            </Copy>
          </li>
          <li>
            <Copy>
              To impersonate or attempt to impersonate Eave Technologies, Inc.,
              a Eave Technologies, Inc. employee, another user, or any other
              person or entity.
            </Copy>
          </li>
          <li>
            <Copy>
              To engage in any other conduct that restricts or inhibits anyone's
              use or enjoyment of our Services, or which, as determined by us,
              may harm Eave Technologies, Inc. or users of our Services or
              expose them to liability.
            </Copy>
          </li>
        </ul>
        <Copy className={classes.para}>
          Eave reserves the right to modify, suspend, or discontinue any of its
          services at any time without prior notice.
        </Copy>
        <Copy className={classes.para}>User Accounts</Copy>
        <Copy className={classes.para}>
          To use certain features of our Services, you are required to create an
          account with us. You agree to provide accurate, current, and complete
          information during the registration process and to update such
          information as necessary to keep it accurate, current, and complete.
          You are responsible for maintaining the confidentiality of your
          account and password and for restricting access to your computer or
          mobile device, and you agree to accept responsibility for all
          activities that occur under your account or password.
        </Copy>
        <Copy className={classes.para}>Fees</Copy>
        <Copy className={classes.para}>
          To use certain features of our Services, you are required to create an
          account with us. You agree to provide accurate, current, and complete
          information during the registration process and to update such
          information as necessary to keep it accurate, current, and complete.
          You are responsible for maintaining the confidentiality of your
          account and password and for restricting access to your computer or
          mobile device, and you agree to accept responsibility for all
          activities that occur under your account or password.
        </Copy>
        <Copy className={classes.para}>Intellectual Property</Copy>
        <Copy className={classes.para}>
          Our Services and their entire contents, features, and functionality
          (including but not limited to all information, software, text,
          displays, images, video, and audio, and the design, selection, and
          arrangement thereof), are owned by Eave Technologies, Inc., its
          licensors, or other providers of such material and are protected by
          United States and international copyright, trademark, patent, trade
          secret, and other intellectual property or proprietary rights laws.
          You may not copy, modify, or distribute any of Eave's intellectual
          property without prior written consent from Eave.
        </Copy>
        <Copy className={classes.para}>Disclaimer of Warranties</Copy>
        <Copy className={classes.para}>
          Our Services are provided "as is" and "as available" without any
          warranty of any kind, either express or implied, including but not
          limited to the implied warranties of merchantability, fitness for a
          particular purpose, and non-infringement. Eave Technologies, Inc. does
          not warrant that our Services will be uninterrupted or error-free,
          that defects will be corrected, or that our Services or the servers
          that make them available are free of viruses or other harmful
          components.
        </Copy>
        <Copy className={classes.para}>Limitation of Liability</Copy>
        <Copy className={classes.para}>
          In no event shall Eave Technologies, Inc. be liable for any direct,
          indirect, incidental, special, or consequential damages arising out of
          or in any way connected with the use of our Services, whether based on
          contract, tort, strict liability, or any other legal theory, even if
          Eave Technologies, Inc. has been advised of the possibility of such
          damages.
        </Copy>
        <Copy className={classes.para}>Indemnification</Copy>
        <Copy className={classes.para}>
          You agree to indemnify, defend, and hold harmless Eave Technologies,
          Inc. and its officers, directors, employees, agents, affiliates,
          successors, and assigns from and against any and all claims, damages,
          liabilities, costs, and expenses (including reasonable attorneys'
          fees) arising out of or in any way connected with your use of our
          Services, your violation of these Terms, or your violation of any
          rights of another.
        </Copy>
        <Copy className={classes.para}>Termination</Copy>
        <Copy className={classes.para}>
          We may terminate or suspend your access to our Services at any time,
          without notice, for any reason, including without limitation if you
          breach these Terms. Upon termination, your right to use our Services
          will immediately cease.
        </Copy>
        <Copy className={classes.para}>Governing Law</Copy>
        <Copy className={classes.para}>
          These Terms shall be governed by and construed in accordance with the
          laws of the State of California, without giving effect to any
          principles of conflicts of law.
        </Copy>
        <Copy className={classes.para}>Changes to Terms</Copy>
        <Copy className={classes.para}>
          Eave reserves the right to modify these Terms at any time. Any changes
          to these Terms will be posted on Eave's website. Your continued use of
          the services provided by Eave after any changes to these Terms will
          constitute your acceptance of such changes.
        </Copy>
        <Copy className={classes.para}>Contact Us</Copy>
        <Copy>
          If you have any questions about these Terms, please contact us at{" "}
          <a className={classes.link} href="mailto:info@eave.fyi">
            info@eave.fyi
          </a>
        </Copy>
      </main>
    </Page>
  );
};

export default TermsPage;
