import path from "node:path";
import Parser from "tree-sitter";
import { CodeFile, changeFileExtension } from "./parsing-utility.js";
import { eaveLogger } from "../logging.js";
import { ProgrammingLanguage } from "../programming-langs/language-mapping.js";

/**
 * In the type declarations for tree-sitter, `node.type` is a string. Here we formalize those types for better readability.
 */
export enum ESNodeType {
  variable_declarator = "variable_declarator",
  identifier = "identifier",
  call_expression = "call_expression",
  import_statement = "import_statement",
  import_clause = "import_clause",
  declaration = "declaration",
  export_statement = "export_statement",
  member_expression = "member_expression",
  string = "string",
  arguments = "arguments",
}

export class ESNode {
  readonly innerNode: Parser.SyntaxNode;
  readonly identifier?: string;
  private __memo_variableMap__?: Map<string, ESNode>;
  private __memo_declarationMap__?: Map<string, ESNode>;
  private __memo_localImportPaths__?: Map<string, string>;

  constructor({ node }: { node: Parser.SyntaxNode }) {
    this.innerNode = node;
    this.identifier = node.children.find((child) => child.type === ESNodeType.identifier)?.text;
  }

  get type(): string {
    return this.innerNode.type;
  }

  /**
   * Adds variable nodes to a map for convenient lookup.
   * Currently only considers variables that are set to a call expression.
   */
  get variables(): Map<string, ESNode> {
    if (this.__memo_variableMap__ !== undefined) {
      return this.__memo_variableMap__;
    }

    const variableNodes = this.innerNode.descendantsOfType(ESNodeType.variable_declarator);
    const variables = new Map<string, ESNode>();
    for (const node of variableNodes) {
      const esNode = new ESNode({ node });
      const identifierNode = esNode.identifier;
      const expressionNode = node.descendantsOfType(ESNodeType.call_expression).at(-1);

      if (identifierNode && expressionNode) {
        variables.set(identifierNode.text, new ESNode({ node: expressionNode }));
      }
    }
    this.__memo_variableMap__ = variables;
    return this.__memo_variableMap__;
  }


  /**
   * Assesses the import statements in the given tree and builds a map of the
   * imported declarations that live in the target repo.
   */
  get imports(): Map<string, string> {
    if (this.__memo_localImportPaths__ !== undefined) {
      return this.__memo_localImportPaths__;
    }

    // Find import statements (ES modules)
    const importNodes =
      this.innerNode.descendantsOfType(ESNodeType.import_statement);
    const importPaths = new Map<string, string>();

    for (const importNode of importNodes) {
      const importClause = importNode.children.find((child) => child.type === ESNodeType.import_clause)[0];
      const importPath = importNode.descendantsOfType(ESNodeType.string)[0]?.text;

      if (importClause && importPath) {
        // TODO: Handle renamed imports (eg: `import path as NodePath from "node:path"`)
        const importNames =
          importClause.text
            .replace(/[\s{}]/g, "")
            .split(",")
            .filter((s) => s) || [];

        for (const importName of importNames) {
          importPaths.set(importName, importPath);
        }
      }
    }

    // Find require statements (Common JS)
    for (const [identifier, node] of this.variables) {
      const expressionNode = node.descendantsOfType(ESNodeType.call_expression)[0];

      if (expressionNode) {
        const expressionNodeIdentifier = expressionNode?.descendantsOfType(ESNodeType.identifier)[0];
        if (expressionNodeIdentifier?.text === "require") {
          const args = expressionNode.descendantsOfType(ESNodeType.arguments)[0];
          const importPath = args?.firstNamedChild?.text;
          if (importPath) {
            importPaths.set(identifier, importPath);
          }
        }
      }
    }

    this.__memo_localImportPaths__ = importPaths;
    return this.__memo_localImportPaths__;
  }

  /**
   * Given a tree, finds all of the top-level declarations in that tree and
   * returns them in a convenient map.
   * Notably, because `export` expressions mask the declaration, this function digs into top-level `export` expressions and includes those declarations too.
   * A declaration is a definition of something, like a class, a function, or a variable.
   * Full list here: https://github.com/tree-sitter/tree-sitter-javascript/blob/f1e5a09b8d02f8209a68249c93f0ad647b228e6e/src/node-types.json#L2-L27
   */
  get declarations(): Map<string, ESNode> {
    if (this.__memo_declarationMap__ !== undefined) {
      return this.__memo_declarationMap__;
    }

    const declarations = new Map<string, Parser.SyntaxNode>();
    for (const node of this.innerNode.namedChildren) {
      const esNode = new ESNode({ node })
      if (node.type.includes(ESNodeType.declaration)) {
        // TODO: Handle anonymous declarations
        if (esNode.identifier) {
          declarations.set(esNode.identifier, esNode);
        }
      }
    }

    this.__memo_declarationMap__ = declarations;
    return this.__memo_declarationMap__;
  }

  /**
   * Given a node, returns the unique set of identifiers referenced in that node.
   * Ignores any exclusions passed in.
   *
   * An identifier is a generic concept, but generally used as the name for something like a declaration. For example:
   *
   *    class Foo {
   *      ...
   *    }
   *
   * The above is a `class_declaration`. The `class_declaration.name` property is an identifier with value "Foo".
   * Function parameters and other grammar features may also have identifiers.
   */
  getUniqueIdentifierReferences({
    exclusions,
  }: {
    exclusions: Array<string>;
  }): Set<string> {
    const identifiers: Set<string> = new Set();
    for (const node of this.innerNode.descendantsOfType(ESNodeType.identifier)) {
      if (!exclusions.includes(node.text)) {
        identifiers.add(node.text);
      }
    }
    return identifiers;
  }
}

export class ESCodeFile extends CodeFile {
  private __memo_rootESNode__?: ESNode;

  get rootNode(): ESNode {
    if (this.__memo_rootESNode__ !== undefined) {
      return this.__memo_rootESNode__;
    }

    this.__memo_rootESNode__ = new ESNode({ node: this.tree.rootNode });
    return this.__memo_rootESNode__;
  }

  normalizeLocalImportPath({
    importPath,
  }: {
    importPath: string;
  }): string | undefined {
    // Don't use path.isAbsolute() here because we're checking node imports, which likely won't start with a fwd-slash
    const isLocal = importPath.at(0) === ".";
    if (!isLocal) {
      return undefined;
    }

    /**
     * The additional "../" strips off the file name, eg:
     *    const fp = "apps/github/app.js"
     *    path.normalize(`${fp}/../server.js`) == "apps/github/server.js"
     */
    const absPath = path.normalize(`${this.path}/../${importPath}`);
    return absPath;
  }
}

function getImportSearchPaths({ importPath }: { importPath: string }): string[] {
  const searchPaths: string[] = [];
  searchPaths.push(importPath);

  const extname = path.extname(importPath);

  if (extname === ".js") {
    // When importing a typescript file, the ".js" extension is usually used. For our purposes, we want to load the TS source.
    const tsPath = changeFileExtension({ filePathOrName: importPath, to: ".ts" });
    searchPaths.push(tsPath);
  }

  if (!extname) { // likely empty string, eg file without an extension
    // Now, a light and incomplete re-implementation of node's module resolution logic.
    // https://nodejs.org/api/modules.html#all-together
    // Note that `require.resolve` can't be used because that operates on the local filesystem, which we aren't using.

    // Node looks for a `package.json`, parses it, and loads the file specified in the `main` field. As we don't have access to the file contents here, we'll hard-code some common filenames and try those.
    searchPaths.push(
      ...implicitExtensionPaths(`${importPath}/index`), // LOAD_INDEX, eg lib/index.js
      ...implicitExtensionPaths(`${importPath}/src/index`), // LOAD_AS_DIRECTORY, eg lib/src/index.js
      ...implicitExtensionPaths(`${importPath}/src/main`), // LOAD_AS_DIRECTORY, eg lib/src/main.js
      ...implicitExtensionPaths(`${importPath}/main`), // LOAD_AS_DIRECTORY, eg lib/main.js
    );
  }

  return searchPaths;
}

/** LOAD_AS_FILE from https://nodejs.org/api/modules.html#all-together */
function implicitExtensionPaths(filePath: string): string[] {
  // These are roughly sorted to put the most common file extensions first, for efficiency for the user.
  return [
    `${filePath}.js`,
    `${filePath}.ts`,
    `${filePath}.cjs`,
    `${filePath}.mjs`,
    `${filePath}.mts`,
    `${filePath}.cts`,
    `${filePath}.json`,
  ];
}
