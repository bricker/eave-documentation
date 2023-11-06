import anyTest, { TestFn } from "ava";
import { dedent } from "../../src/util.js";
import { ESCodeFile } from "../../src/parsing/es-parsing.js";
import { TestContextBase, TestUtil } from "../../src/test-util.js";
import { parseCode } from "../../src/parsing/parsing-utility.js";
import { ExpressCodeFile } from "../../src/parsing/express-parsing.js";

const test = anyTest as TestFn<TestContextBase>;

test.beforeEach((t) => {
  t.context = {
    u: new TestUtil(),
  };
});

test("express root file negative if file isnt supported language", (t) => {
  const codeFile = new ExpressCodeFile({ path: "file.asm", contents: "" });
  t.assert(!codeFile.isExpressRootFile)
});

test("express root file negative for not express app", (t) => {
  const contents = dedent(`
    import logging from "logging";
    logging.warn("...");
  `).trim();

  const codeFile = new ExpressCodeFile({ path: "file.js", contents });
  t.assert(!codeFile.isExpressRootFile)
});

test("express root file positive for standard express app setup", (t) => {
  const contents = dedent(`
    import express from "express";
    const app = express();
    app.listen();
  `).trim();

  const codeFile = new ExpressCodeFile({ path: "file.js", contents });
  t.assert(codeFile.isExpressRootFile)
});
