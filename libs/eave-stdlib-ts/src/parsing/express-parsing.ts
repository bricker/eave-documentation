import path from "node:path";
import Parser from "tree-sitter";
import { ExpressRoutingMethod, JsonObject } from "../types.js";
import { assertPresence, dedent, titleize } from "../util.js";
import { ESCodeFile, ESNodeType } from "./es-parsing.js";
import assert from "node:assert";

export class ExpressCodeFile extends ESCodeFile {
  private __memo_expressAppIdentifier__?: string;
  private __memo_expressRouterIdentifier__?: string;
  private __memo_expressRouterMounts__?: string;

  // /**
  //  * Returns true if the text for a given node is setting up an Express route.
  //  * Otherwise, returns false.
  //  */
  // testExpressRouteCall({
  //   node,
  // }: {
  //   node: Parser.SyntaxNode;
  // }): boolean {
  //   const appIdentifier = this.expressAppIdentifier;
  //   const routerIdentifier = this.expressRouterIdentifier;

  //   node.

  //   const children = this.getNodeChildMap({ node });
  //   const expression = this.getExpression({ siblings: children });
  //   if (expression) {
  //     if (router) {
  //       return expression === `${router}.use`;
  //     }
  //     if (expression.startsWith(`${app}.`)) {
  //       for (const method of Object.values(ExpressRoutingMethod)) {
  //         if (expression === `${app}.${method}`) {
  //           return true;
  //         }
  //       }
  //     }
  //   }
  //   return false;
  // }

  get expressRouterMounts(): string[] {
    if (this.__memo_expressRouterMounts__ !== undefined) {
      return this.__memo_expressRouterMounts__;
    }


    return this.__memo_expressRouterMounts__;
  }

  get expressRouteDefinitions(): string[] {
  }

  get expressRouterIdentifier(): string | undefined {
    if (this.__memo_expressRouterIdentifier__ !== undefined) {
      return this.__memo_expressRouterIdentifier__;
    }

    if (!this.language) {
      // Language isn't supported.
      return undefined;
    }

    const captureNames = {
      varId: "varId",
      functionId: "function.id",
      propertyId: "member_expression.property.id"
    };

    /**
     * Example code being queried:
     *
     * ```
     * import { Router } from "express";
     * const router = Router();
     * ```
     *
     * Given the above code, this function will return "router", the name of the variable used to initialize the router.
     *
     * The function can also find routers defined as a member expression. For example:
     *
     * ```
     * import express from "express";
     * const router = express.Router();
     * ```
     *
     * This function will again return "router" for that code.
     */
    const query = new Parser.Query(this.grammar, dedent(`
      (${ESNodeType.variable_declarator}
        name: (${ESNodeType.identifier}) @${captureNames.varId}
        value: (${ESNodeType.call_expression}
          function: [
            ((${ESNodeType.identifier}) @${captureNames.functionId})
            (${ESNodeType.member_expression}
              object: (${ESNodeType.identifier})
              property: (${ESNodeType.property_identifier}) @${captureNames.propertyId}
            )
          ]
        )
      )
    `).trim());

    const matches = query.matches(this.rootNode.innerNode);

    // TODO: These are common names for these imports, but renamed imports aren't handled. eg: `import { Router as ExpressRouter } from "express"` is not handled.
    const routerCallMatch = matches?.find((qmatch: Parser.QueryMatch) => {
      const functionIdCapture = qmatch.captures.find((c) => c.name === captureNames.functionId);
      const propertyIdCapture = qmatch.captures.find((c) => c.name === captureNames.propertyId);
      return functionIdCapture?.node.text === "Router" || propertyIdCapture?.node.text === "Router";
    });

    if (!routerCallMatch) {
      return undefined;
    }

    const variableIdCapture = routerCallMatch.captures.find((c) => c.name === captureNames.varId);
    assertPresence(variableIdCapture);

    this.__memo_expressRouterIdentifier__ = variableIdCapture.node.text;
    return this.__memo_expressRouterIdentifier__;
  }

  /**
   * Searches a tree for relevant Express calls and returns the variables that
   * are used to declare the root Express app.
   * Example:
   *    const app = express();
   * In this code, the identifier "app" would be returned from this function.
   */
  get expressAppIdentifier(): string | undefined {
    if (this.__memo_expressAppIdentifier__ !== undefined) {
      return this.__memo_expressAppIdentifier__;
    }

    if (!this.language) {
      // Language isn't supported.
      return undefined;
    }

    const captureNames = {
      varId: "varId",
      functionId: "functionId"
    };

    /**
     * Example code being queried:
     *
     * ```
     * import express from "express";
     * const app = express();
     * app.listen();
     * ```
     *
     * Given the above code, this function will return "app", the name of the variable used to initialize the express app.
     */
    const query = new Parser.Query(this.grammar, dedent(`
      (${ESNodeType.variable_declarator}
        name: (${ESNodeType.identifier}) @${captureNames.varId}
        value: (${ESNodeType.call_expression}
          function: (${ESNodeType.identifier}) @${captureNames.functionId}
        )
      )
    `).trim());

    const matches = query.matches(this.rootNode.innerNode);

    // Find a `call_expression` with function identifier "express" or "Express"
    // These are common names for these imports, but we'll miss non-standard import names like `import ApiFramework from "express"`
    const expressCallMatch = matches?.find((qmatch: Parser.QueryMatch) => {
      const functionIdCapture = qmatch.captures.find((c) => c.name === captureNames.functionId);
      return functionIdCapture?.node.text.toLowerCase() === "express";
    });

    if (!expressCallMatch) {
      return undefined;
    }

    const variableIdCapture = expressCallMatch.captures.find((c) => c.name === captureNames.varId);
    assertPresence(variableIdCapture);

    this.__memo_expressAppIdentifier__ = variableIdCapture.node.text;
    return this.__memo_expressAppIdentifier__;
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
