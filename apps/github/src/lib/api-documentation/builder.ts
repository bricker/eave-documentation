import {
  ExpressAPI,
  ExpressCodeFile,
} from "@eave-fyi/eave-stdlib-ts/src/parsing/express-parsing.js";
import { changeFileExtension } from "@eave-fyi/eave-stdlib-ts/src/parsing/parsing-utility.js";
import {
  LogContext,
  eaveLogger,
} from "@eave-fyi/eave-stdlib-ts/src/logging.js";
import { ProgrammingLanguage } from "@eave-fyi/eave-stdlib-ts/src/programming-langs/language-mapping.js";
import { CtxArg } from "@eave-fyi/eave-stdlib-ts/src/requests.js";
import { JsonValue } from "@eave-fyi/eave-stdlib-ts/src/types.js";
import { assertPresence } from "@eave-fyi/eave-stdlib-ts/src/util.js";
import { assertIsBlob } from "../graphql-util.js";
import { CoreAPIData } from "./core-api.js";
import { GithubAPIData } from "./github-api.js";
import { getImportSearchPaths, resolveImportLookupPaths } from "@eave-fyi/eave-stdlib-ts/src/parsing/es-parsing.js";
import { Blob } from "@octokit/graphql-schema";

export class ExpressAPIDocumentBuilder {
  readonly logParams: { [key: string]: JsonValue };
  private readonly githubAPIData: GithubAPIData;
  private readonly coreAPIData: CoreAPIData;
  private readonly ctx: LogContext;
  private readonly apiRootFile: ExpressCodeFile;

  /**
   * Asynchronously builds an Express API from the provided GitHub and core API data.
   * It fetches the external GitHub repository, creates an Express API instance, and iterates over the Git tree entries.
   * If a valid Express root file is found, it is set as the root file of the API.
   * If no root file is found, a warning is logged and the API instance is returned.
   * If a root file is found, it proceeds to build the API documentation using the ExpressAPIDocumentBuilder.
   * It then finds and sets the Express API endpoints.
   * If no endpoints are found, a warning is logged.
   * Finally, it logs the found Express endpoints and returns the API instance.
   *
   * @param {Object} args - The arguments object.
   * @param {GithubAPIData} args.githubAPIData - The GitHub API data.
   * @param {CoreAPIData} args.coreAPIData - The core API data.
   * @param {Object} args.ctx - The context object.
   * @param {string} args.apiRootDir - The root directory of the API.
   * @returns {Promise<ExpressAPI>} - A promise that resolves to an Express API instance.
   */
  static async buildAPI({
    githubAPIData,
    coreAPIData,
    ctx,
    apiRootDir,
  }: CtxArg & {
    githubAPIData: GithubAPIData;
    coreAPIData: CoreAPIData;
    apiRootDir: string;
  }): Promise<ExpressAPI> {
    const externalGithubRepo = await githubAPIData.getExternalGithubRepo();
    const apiInfo = new ExpressAPI({
      externalRepoId: externalGithubRepo.id,
      rootDir: apiRootDir,
    });

    for await (const treeEntry of githubAPIData.recurseGitTree({
      treeRootDir: apiRootDir,
    })) {
      const blob = treeEntry.object;
      assertIsBlob(blob);
      if (!blob.text) {
        // text is either null (binary object), undefined (not in response), or empty string (empty file). Either way, move on.
        continue;
      }

      assertPresence(treeEntry.path);
      const file = new ExpressCodeFile({
        path: treeEntry.path,
        contents: blob.text,
      });
      if (file.isExpressRootFile()) {
        // We found the file; Early-exit the loop
        apiInfo.rootFile = file;
        break;
      }
    }

    if (!apiInfo.rootFile) {
      eaveLogger.warning(
        "No express API root file found",
        { api_root_dir: apiRootDir, github_data: githubAPIData.logParams },
        ctx,
      );
      return apiInfo;
    }

    const builder = new ExpressAPIDocumentBuilder({
      apiRootFile: apiInfo.rootFile,
      githubAPIData,
      coreAPIData,
      ctx,
    });
    const endpoints = await builder.findExpressAPIEndpoints();
    apiInfo.endpoints = endpoints;

    if (endpoints.length === 0) {
      eaveLogger.warning(
        "No express API endpoints found",
        {
          api_root_dir: apiRootDir,
          api_root_file: apiInfo.rootFile?.asJSON,
          github_data: githubAPIData.logParams,
        },
        ctx,
      );
    }

    eaveLogger.debug(
      "found express endpoints",
      {
        api_info: apiInfo.asJSON,
        api_root_dir: apiRootDir,
        api_root_file: apiInfo.rootFile?.asJSON,
        github_data: githubAPIData.logParams,
      },
      builder.logParams,
      ctx,
    );

    return apiInfo;
  }

  /**
   * A private constructor that initializes the instance with the provided context and API data.
   *
   * @param apiRootFile - An ExpressCodeFile instance representing the root file of the API.
   * @param githubAPIData - A GithubAPIData instance containing data from the Github API.
   * @param coreAPIData - A CoreAPIData instance containing data from the core API.
   * @param ctx - The context in which the instance is created.
   */
  private constructor({
    apiRootFile,
    githubAPIData,
    coreAPIData,
    ctx,
  }: CtxArg & {
    apiRootFile: ExpressCodeFile;
    githubAPIData: GithubAPIData;
    coreAPIData: CoreAPIData;
  }) {
    this.githubAPIData = githubAPIData;
    this.coreAPIData = coreAPIData;
    this.ctx = ctx;
    this.apiRootFile = apiRootFile;

    this.logParams = {
      github_data: githubAPIData.logParams,
      core_api_data: coreAPIData.logParams,
      api_root_file: apiRootFile.asJSON,
    };
  }

  /**
   * Asynchronously finds all Express API endpoints in the root file of the API.
   * Given the root file for an Express API, this function attempts to identify
   * each API endpoint in the file. It builds a list of local requires and imports,
   * gets the declaration map of the root file, and identifies the Express app and router.
   * It then iterates over all call expressions in the root file, and for each call that
   * is a middleware or route call, it generates the corresponding code, including any
   * necessary imports, requires, or declarations. It also builds the code for each endpoint.
   *
   * @returns {Promise<Array<string>>} A promise that resolves to an array of strings,
   * each string being the code for an Express API endpoint.
   * @private
   */
  private async findExpressAPIEndpoints(): Promise<Array<string>> {
    const calls =
      this.apiRootFile.tree.rootNode.descendantsOfType("call_expression");
    const requires = await this.buildLocalRequires();
    const imports = await this.buildLocalImports();
    const declarations = this.apiRootFile.exportedDeclarations();
    const { app = "", router = "" } =
      await this.apiRootFile.expressAppIdentifiers();
    const apiEndpoints: Array<string> = [];

    let baseCode = `import express from 'express';\nconst ${app} = express();\n`;
    if (router) {
      baseCode += `const ${router} = express.Router();\n`;
    }

    for (const call of calls) {
      let endpointCode = `${baseCode}`;
      const isMiddleWareCall = call.text.startsWith(`${app}.use`);
      if (isMiddleWareCall) {
        endpointCode += `${call.text}\n`;
      }

      const isRouteCall = await this.apiRootFile.testExpressRouteCall({
        node: call,
        app,
        router,
      });
      if (isRouteCall) {
        endpointCode += `${call.text}\n`;
        const nestedIdentifiers = this.apiRootFile.getUniqueIdentifierReferences({
          rootNode: call,
          exclusions: [app, router],
        });
        for (const identifier of nestedIdentifiers) {
          const importCode = imports.get(identifier);
          if (importCode) {
            endpointCode += `${importCode}\n`;
            continue;
          }
          const requireCode = requires.get(identifier);
          if (requireCode) {
            endpointCode += `${requireCode}\n`;
            continue;
          }
          const declarationCode = declarations.get(identifier)?.text;
          if (declarationCode) {
            endpointCode += `${declarationCode}\n`;
          }
        }
        apiEndpoints.push(endpointCode);
      }
    }

    return apiEndpoints;
  }

  /**
   * Asynchronously concatenates import declarations from a given ExpressCodeFile.
   *
   * This method first checks if the provided identifier is declared in the given file. If it is, the method concatenates the declaration text and recursively builds up all of the local source code for that declaration, checking for any inner identifiers that need to be imported.
   *
   * If the identifier is not found in the given file, the method checks for a default export and recursively concatenates the import declarations from the default exported file.
   *
   * @param {Object} params - The parameters for the function.
   * @param {string} params.identifier - The identifier to search for in the ExpressCodeFile.
   * @param {ExpressCodeFile} params.expressCodeFile - The ExpressCodeFile to search in.
   *
   * @returns {Promise<string>} A promise that resolves to a string of concatenated import declarations.
   */
  private async concatenateImports({
    identifier,
    expressCodeFile,
  }: {
    identifier?: string;
    expressCodeFile: ExpressCodeFile;
  }): Promise<string> {
    if (!identifier) {
      // We're not looking for a specific identifier, so we'll
    }
    const declarations = expressCodeFile.exportedDeclarations();
    const declaration = declarations.get(identifier);

    let accumulator = "";

    // Case 2: The given identifier is declared in the given file.
    if (declaration) {
      accumulator += `${declaration.text}\n\n`;
      const imports = expressCodeFile.getLocalImportPaths();
      const requires = expressCodeFile.getLocalRequirePaths();
      const innerIdentifiers = expressCodeFile.getUniqueIdentifierReferences({
        rootNode: declaration,
        exclusions: [identifier],
      });

      for (const innerIdentifier of innerIdentifiers) {
        const innerDeclaration = declarations.get(innerIdentifier);
        const isRequire = innerDeclaration?.text.match(
          /require\(["|'][^"|']+?["|']\)/,
        );
        if (innerDeclaration && !isRequire) {
          accumulator += `${innerDeclaration.text}\n\n`;
          continue;
        }
        const importPath = imports.get(innerIdentifier);
        if (importPath) {
          const importedFile = await this.getExpressCodeFile({
            filePath: importPath,
          });
          if (importedFile) {
            const c = await this.concatenateImports({
              identifier: innerIdentifier,
              expressCodeFile: importedFile,
            });
            accumulator += c;
          }
          continue;
        }
        const requireLookupPaths = requires.get(innerIdentifier);
        if (requireLookupPaths) {
          for (const importPath of requireLookupPaths) {
            const importedFile = await this.getExpressCodeFile({
              filePath: importPath,
            });
            if (importedFile) {
              const c = await this.concatenateImports({
                identifier: innerIdentifier,
                expressCodeFile: importedFile,
              });
              accumulator += c;
            }
          }
        }
      }
      return accumulator;
    }

    // Case 3: The declaration we're looking for wasn't found -- check for default export.
    const exportNodes =
      expressCodeFile.tree.rootNode.descendantsOfType("export_statement");
    for (const exportNode of exportNodes) {
      const children = expressCodeFile.getNodeChildMap({ node: exportNode });
      if (children.has("default")) {
        const defaultIdentifier = children.get("identifier")?.text;
        if (defaultIdentifier) {
          const c = await this.concatenateImports({
            identifier: defaultIdentifier,
            expressCodeFile,
          });
          accumulator += c.replaceAll(defaultIdentifier, identifier);
        }
      }
    }

    return accumulator;
  }

  /**
   * Asynchronously builds a map of local imports from the given tree, which represents the API root file.
   * Each key-value pair in the map represents an identifier and its corresponding import code.
   *
   * @returns {Promise<Map<string, string>>} A promise that resolves to a map of identifiers to import codes.
   */
  private async buildLocalImports(): Promise<Map<string, string>> {
    const imports = this.apiRootFile.getLocalImportPaths();
    const importedCode = new Map<string, string>();
    for (const [identifier, importPath] of imports) {
      const expressCodeFile = await this.getExpressCodeFile({
        filePath: importPath,
      });
      const importCode = await this.concatenateImports({
        identifier,
        expressCodeFile,
      });
      importedCode.set(identifier, importCode);
    }
    return importedCode;
  }

  /**
   * Asynchronously builds a map of local require paths and their corresponding code from a given tree.
   * It fetches the local require paths from the API root file, retrieves the express code file for each path,
   * concatenates the imports, and sets the identifier and concatenated code in the map.
   * This process is used to build the local source code for the top-level required modules found in the tree.
   *
   * @returns {Promise<Map<string, string>>} A promise that resolves to a map where the key is the identifier and the value is the corresponding require code.
   * @private
   */
  private async buildLocalRequires(): Promise<Map<string, string>> {
    const requires = this.apiRootFile.getLocalRequirePaths();
    const importedCode = new Map();

    for (const [identifier, requireLookupPaths] of requires) {
      for (const requireLookupPath of requireLookupPaths) {
        const expressCodeFile = await this.getExpressCodeFile({
          filePath: requireLookupPath,
        });
        if (expressCodeFile) {
          const requireCode = await this.concatenateImports({
            identifier,
            expressCodeFile,
          });
          importedCode.set(identifier, requireCode);
        }
      }
    }

    return importedCode;
  }

  /**
   * Asynchronously retrieves an ExpressCodeFile instance for a given file path.
   * If the file does not exist or is a JavaScript import with a TypeScript source file, it attempts to retrieve the TypeScript file.
   * If the file contents are empty, a warning is logged and an ExpressCodeFile with empty contents is returned.
   *
   * @param {Object} params - An object containing the file path.
   * @param {string} params.filePath - The path of the file to retrieve.
   * @returns {Promise<ExpressCodeFile>} A promise that resolves to an ExpressCodeFile instance.
   */
  private async getExpressCodeFile({
    filePath,
  }: {
    filePath: string;
  }): Promise<ExpressCodeFile | null> {
    const file = new ExpressCodeFile({ path: filePath, contents: "" }); // empty contents as placeholder
    const searchPaths = getImportSearchPaths({ importPath: filePath })

    let gitBlob: Blob | undefined;
    for (const searchPath of searchPaths) {
      const blob = await this.githubAPIData.getFileContent({ filePath: searchPath });

      // Because we try a bunch of possible files, it's normal for the file not to exist.
      // In that case, we'll try the next file.
      // If the file existed, then we'll use that and stop looking.
      if (blob) {
        gitBlob = blob;
        break;
      }
    }

    if (!gitBlob) {
      eaveLogger.warning(
        "getExpressCodeFile - no file found for import",
        { file_path: filePath, file: file.asJSON, search_paths: searchPaths },
        this.logParams,
        this.ctx,
      );
      return null;
    }

    if (!gitBlob.text) {
      eaveLogger.warning(
        "getExpressCodeFile - empty file contents",
        { file_path: filePath, file: file.asJSON, search_paths: searchPaths },
        this.logParams,
        this.ctx,
      );
      return file;
    }

    file.contents = gitBlob.text;
    return file;
  }
}
