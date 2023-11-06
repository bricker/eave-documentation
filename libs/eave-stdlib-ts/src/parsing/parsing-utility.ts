import nodePath from "node:path";
import Parser from "tree-sitter";
import { TreeSitterGrammar, grammarForFilePathOrName, grammarForLanguage } from "./grammars.js";
import {
  ProgrammingLanguage,
  getProgrammingLanguageByFilePathOrName,
} from "../programming-langs/language-mapping.js";
import { JsonObject } from "../types.js";
import { normalizeExtName } from "../util.js";

export class CodeFile {
  contents: string;
  readonly path: string;
  private __memo_tree__?: Parser.Tree;

  constructor({ path, contents }: { path: string; contents: string }) {
    this.path = path;
    this.contents = contents;
  }

  get asJSON(): JsonObject {
    return {
      path: this.path,
      language: this.language,
      dirname: this.dirname,
      extname: this.extname,
    };
  }

  get tree(): Parser.Tree {
    if (this.__memo_tree__ !== undefined) {
      return this.__memo_tree__;
    }

    const tree = parseCode({ filePathOrName: this.path, code: this.contents });
    this.__memo_tree__ = tree;
    return this.__memo_tree__;
  }

  get language(): ProgrammingLanguage | undefined {
    return getProgrammingLanguageByFilePathOrName(this.path);
  }

  get grammar(): TreeSitterGrammar | undefined {
    return grammarForFilePathOrName(this.path) || undefined; // forward null as undefined
  }

  get dirname(): string {
    return nodePath.dirname(this.path);
  }

  get extname(): string {
    return nodePath.extname(this.path);
  }
}

export function parseCode({
  filePathOrName,
  code,
}: {
  filePathOrName: string;
  code: string;
}): Parser.Tree {
  const parser = makeParser({ filePathOrName });
  return parser.parse(code);
}

export function makeParser({
  filePathOrName,
}: {
  filePathOrName: string;
}): Parser {
  const grammar = grammarForFilePathOrName(filePathOrName);
  const parser = new Parser();
  parser.setLanguage(grammar);
  return parser;
}

export function changeFileExtension({
  filePathOrName,
  to,
}: {
  filePathOrName: string;
  to: string;
}): string {
  const p = nodePath.parse(filePathOrName);
  p.base = ""; // node ignores p.ext and p.name if p.base is provided
  p.ext = normalizeExtName(to);
  return nodePath.format(p);
}
