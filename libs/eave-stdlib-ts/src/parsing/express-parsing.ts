import path from "node:path";
import Parser from "tree-sitter";
import { ExpressRoutingMethod, JsonObject } from "../types.js";
import { titleize } from "../util.js";
import { ESCodeFile } from "./es-parsing.js";

type ExpressIdentifiers = {
  app?: string;
  router?: string;
};

export class ExpressCodeFile extends ESCodeFile {
  private __memo_expressAppIdentifiers__?: ExpressIdentifiers;
  private __memo_testExpressRootFile__?: boolean;

  testExpressRootFile(): boolean {
    if (this.__memo_testExpressRootFile__ !== undefined) {
      return this.__memo_testExpressRootFile__;
    }

    if (!this.language) {
      // Language isn't supported.
      return false;
    }

    const variables = this.variables();

    for (const expressionNode of variables.values()) {
      const children = this.getNodeChildMap({ node: expressionNode });
      const expression = this.getExpression({ siblings: children });
      if (expression === "express") {
        // We think this file initializes an Express server.
        this.__memo_testExpressRootFile__ = true;
        return this.__memo_testExpressRootFile__;
      }
    }

    // We didn't see an Express server initialized in this file.
    this.__memo_testExpressRootFile__ = false;
    return this.__memo_testExpressRootFile__;
  }

  /**
   * Returns true if the text for a given node is setting up an Express route.
   * Otherwise, returns false.
   */
  testExpressRouteCall({
    node,
    app,
    router,
  }: {
    node: Parser.SyntaxNode;
    app: string;
    router: string;
  }): boolean {
    const children = this.getNodeChildMap({ node });
    const expression = this.getExpression({ siblings: children });
    if (expression) {
      if (router) {
        return expression === `${router}.use`;
      }
      if (expression.startsWith(`${app}.`)) {
        for (const method of Object.values(ExpressRoutingMethod)) {
          if (expression === `${app}.${method}`) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Searches a tree for relevant Express calls and returns the variables that
   * are used to declare the root Express app and the Express Router if needed.
   */
  getExpressAppIdentifiers(): ExpressIdentifiers {
    if (this.__memo_expressAppIdentifiers__ !== undefined) {
      return this.__memo_expressAppIdentifiers__;
    }

    const variables = this.variables();
    const identifiers: ExpressIdentifiers = {};

    for (const [identifier, expressionNode] of variables) {
      const children = this.getNodeChildMap({ node: expressionNode });
      const expression = this.getExpression({ siblings: children });
      if (expression === "express") {
        identifiers.app = identifier;
        continue;
      }
      if (expression === "express.Router" || expression === "Router") {
        identifiers.router = identifier;
      }
    }
    this.__memo_expressAppIdentifiers__ = identifiers;
    return this.__memo_expressAppIdentifiers__;
  }
}

export class ExpressAPI {
  externalRepoId: string;
  rootDir?: string;
  rootFile?: ExpressCodeFile;
  endpoints?: string[];
  documentationFilePath?: string;
  documentation?: string;

  private __name__?: string;

  constructor({
    externalRepoId,
    name,
    rootDir,
    rootFile,
    endpoints,
    documentationFilePath,
    documentation,
  }: {
    externalRepoId: string;
    name?: string;
    rootDir?: string;
    rootFile?: ExpressCodeFile;
    documentationFilePath?: string;
    endpoints?: string[];
    documentation?: string;
  }) {
    if (name !== undefined) {
      this.name = name;
    }

    this.externalRepoId = externalRepoId;
    this.rootDir = rootDir;
    this.rootFile = rootFile;
    this.endpoints = endpoints;
    this.documentationFilePath = documentationFilePath;
    this.documentation = documentation;
  }

  /**
   * Uses an Express API's root directory name to cobble together a guess for
   * what the name of the API is.
   *
   * NOTE: I kind of hate this. If you are reading this and can think of a
   * better solution, feel free to gently place this code into a trash can.
   */
  get name(): string {
    if (this.__name__) {
      return this.__name__;
    }

    if (!this.rootDir) {
      // TODO: Better fallback?
      return "API";
    }

    const dirName = path.basename(this.rootDir);
    const apiName = dirName.replace(/[^a-zA-Z0-9]/g, " ").toLowerCase();
    const capitalizedName = titleize(apiName).replace(/ api ?$/gi, "");
    const guessedName = `${capitalizedName} API`;
    this.__name__ = guessedName;
    return this.__name__;
  }

  set name(v: string) {
    this.__name__ = v;
  }

  get asJSON(): JsonObject {
    return {
      externalRepoId: this.externalRepoId,
      rootDir: this.rootDir,
      rootFile: this.rootFile?.asJSON,
      documentationFilePath: this.documentationFilePath,
    };
  }
}
