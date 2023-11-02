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
    const foobar = "foobar-value";
    return foobar;
  }

  const bar = "bar-value";
`).trim();


test("descendantsOfType", (t) => {
  const tree = parseCode({ filePathOrName: "file.js", code: contents });
  console.log(tree.rootNode.toString());
  const identifiers = tree.rootNode.descendantsOfType("identifier").map((n) => n.text);
  console.dir(identifiers);
  t.deepEqual(identifiers, ["foo", "bar"]);
});
