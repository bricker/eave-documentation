// @ts-check
const nodemon = require("nodemon/lib");
const {
  populateEnv,
  loadDotenv,
} = require("../../../../develop/javascript/dotenv-loader.cjs");
const { EAVE_HOME } = require("../../../../develop/javascript/constants.cjs");

loadDotenv({ path: "develop/shared/share.env", override: true });
loadDotenv({ path: ".env", override: true });

populateEnv({
  GAE_SERVICE: "jira",
  PORT: "5500",
});

nodemon(
  [
    `--exec ${EAVE_HOME}/node_modules/.bin/tsx`,
    "--watch ./src",
    `--watch ${EAVE_HOME}/libs/eave-stdlib-ts`,
    "--delay 5",
    "./server.ts",
  ].join(" "),
);
