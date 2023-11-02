import anyTest, { TestFn } from "ava";
import { dedent } from "../../src/util.js";
import { ESCodeFile } from "../../src/parsing/es-parsing.js";
import { TestContextBase, TestUtil } from "../../src/test-util.js";
import { parseCode } from "../../src/parsing/parsing-utility.js";

const test = anyTest as TestFn<TestContextBase>;

test.beforeEach((t) => {
  t.context = {
    u: new TestUtil(),
  };
});

const contents = dedent(`
  import { import } from './file.js';

  function foo() {
    const foobar = "foobar";
    return foobar;
  }

  const bar = "bar";
`).trim();


test("ESNode identifier for rootNode is undefined", (t) => {
  const codeFile = new ESCodeFile({ path: t.context.u.anystr(), contents });
  t.assert(codeFile.rootNode.identifier === undefined);
});

// test("ESNode identifier for function", (t) => {
//   const codeFile = new ESCodeFile({ path: t.context.u.anystr(), contents });
//   const functionNode = codeFile.rootNode.declarations.get("foo");
//   t.assert(functionNode.identifier
//   t.assert(codeFile.rootNode.identifier === undefined);
// });

// test("variables", (t) => {
//   const codeFile = new ESCodeFile({ path: t.context.u.anystr(), contents });
//   t.assert(codeFile.rootNode.identifier === undefined);
// });
