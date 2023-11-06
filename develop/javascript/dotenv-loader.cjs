// @ts-check
const platformPath = require("node:path");
const dotenv = require("dotenv");
const { EAVE_HOME, GOOGLE_CLOUD_PROJECT } = require("./constants.cjs");

function loadDotenv({ path, override = true }) {
  dotenv.config({
    path: platformPath.join(EAVE_HOME, path),
    override,
  });
}

/**
 * Loads environment variables from standard dotenv files.
 *
 * First, it loads variables from the 'develop/shared/share.env' file, then from the '.env' file.
 * Finally, it attempts to load variables from a file named after the current Google Cloud project.
 * If the latter file is not found, a warning is logged.
 *
 * All loaded variables override existing ones.
 */
function loadStandardDotenvFiles() {
  loadDotenv({ path: "develop/shared/share.env", override: true });
  loadDotenv({ path: ".env", override: true });

  try {
    loadDotenv({ path: `.${GOOGLE_CLOUD_PROJECT}.env`, override: true });
  } catch (e) {
    console.warn(`.${GOOGLE_CLOUD_PROJECT}.env file not found`);
  }
}

/**
 * Populates the environment variables with the parsed input using the dotenv library.
 * Overrides any existing variables with the same name.
 *
 * @param {import("dotenv").DotenvPopulateInput} parsed - The parsed input to populate the environment variables with.
 */
function populateEnv(
  /** @type {import("dotenv").DotenvPopulateInput} */ parsed,
) {
  dotenv.populate(process.env, parsed, { override: true });
}

module.exports = { loadDotenv, loadStandardDotenvFiles, populateEnv };
