import test from "ava";
import {
  assertValidSyntax,
  parseFunctionsAndComments,
  writeUpdatedCommentsIntoFileString,
} from "../../src/parsing/function-parsing.js";
import { ProgrammingLanguage } from "../../src/programming-langs/language-mapping.js";

test("Typescript grammar queries adds/replaces all doc comments correctly", (t) => {
  // GIVEN string content of a file (and language/ext data)
  // (note: function variable string indentation is important; dont adjust to match this file's indentation level)
  const filePath = "src/file.ts";
  const language = ProgrammingLanguage.typescript;
  const content = `import { appConfig } from './src/config.js';

function foo() {
  console.log('foo');
}

class MyClass {
  bar(): string {
    return "bar";
  }
}

export function baz(): string {
  return "baz";
}

/**
 * Doc comment
 * @param to be replaced
 * @returns by parse code
 */
async function fizzbuzz(): Promise<string> {
  return 'fizzbuzz';
}
`;

  // WHEN content parsed by tree-sitter grammars
  const funcDocsArray = parseFunctionsAndComments({
    content,
    filePath,
    language,
  });

  // THEN all functions should be detected/parsed by queries
  t.deepEqual(funcDocsArray.length, 4);

  // WHEN new doc comments are written into file content
  for (let i = 0; i < funcDocsArray.length; i += 1) {
    funcDocsArray[i]!.updatedComment = `/**
 * Great new docs
 * @param Eave wrote
 * @return very well
 */`;
  }
  const updatedContent = writeUpdatedCommentsIntoFileString(
    content,
    funcDocsArray,
  );

  // THEN updated file content should be fully documented at correct indentation levels
  const expectedUpdatedContent = `import { appConfig } from './src/config.js';

/**
 * Great new docs
 * @param Eave wrote
 * @return very well
 */
function foo() {
  console.log('foo');
}

class MyClass {
  /**
   * Great new docs
   * @param Eave wrote
   * @return very well
   */
  bar(): string {
    return "bar";
  }
}

/**
 * Great new docs
 * @param Eave wrote
 * @return very well
 */
export function baz(): string {
  return "baz";
}

/**
 * Great new docs
 * @param Eave wrote
 * @return very well
 */
async function fizzbuzz(): Promise<string> {
  return 'fizzbuzz';
}
`;
  t.deepEqual(updatedContent, expectedUpdatedContent);
});

test("Javascript grammar queries adds/replaces all doc comments correctly", (t) => {
  // GIVEN string content of a file (and language/ext data)
  // (note: function variable string indentation is important; dont adjust to match this file's indentation level)
  const filePath = "src/file.js";
  const language = ProgrammingLanguage.javascript;
  const content = `const appConfig = require('./src/config.js');

function foo() {
  console.log('foo');
}

class MyClass {
  bar() {
    return "bar";
  }
}

module.exports = function baz() {
  return "baz";
}

/**
 * Doc comment
 * @param to be replaced
 * @returns by parse code
 */
async function fizzbuzz() {
  return 'fizzbuzz';
}
`;

  // WHEN content parsed by tree-sitter grammars
  const funcDocsArray = parseFunctionsAndComments({
    content,
    filePath,
    language,
  });

  // THEN all functions should be detected/parsed by queries
  // NOTE: 3 instead of 4 bcus cjs module export function on same line is not detected by current
  // queries and is probably better that way? Without some custom logic to see if assignment
  // is to module.exports, we would end up generating docs for lambda functions etc as well,
  // which we probably don't want.
  t.deepEqual(funcDocsArray.length, 3);

  // WHEN new doc comments are written into file content
  for (let i = 0; i < funcDocsArray.length; i += 1) {
    funcDocsArray[i]!.updatedComment = `/**
 * Great new docs
 * @param Eave wrote
 * @return very well
 */`;
  }
  const updatedContent = writeUpdatedCommentsIntoFileString(
    content,
    funcDocsArray,
  );

  // THEN updated file content should be fully documented at correct indentation levels
  const expectedUpdatedContent = `const appConfig = require('./src/config.js');

/**
 * Great new docs
 * @param Eave wrote
 * @return very well
 */
function foo() {
  console.log('foo');
}

class MyClass {
  /**
   * Great new docs
   * @param Eave wrote
   * @return very well
   */
  bar() {
    return "bar";
  }
}

module.exports = function baz() {
  return "baz";
}

/**
 * Great new docs
 * @param Eave wrote
 * @return very well
 */
async function fizzbuzz() {
  return 'fizzbuzz';
}
`;
  t.deepEqual(updatedContent, expectedUpdatedContent);
});

test("Rust grammar queries adds/replaces all doc comments correctly", (t) => {
  // GIVEN string content of a file (and language/ext data)
  // (note: function variable string indentation is important; dont adjust to match this file's indentation level)
  const filePath = "src/file.rs";
  const language = ProgrammingLanguage.rust;
  const content = `mod app_config;

fn foo() {
  println!("foo");
}

pub struct MyClass;

impl MyClass {
  pub fn bar(&self) -> &str {
    "bar"
  }
}

pub fn baz(): -> &str {
  "baz"
}

/// Doc comment
/// @param to be replaced
/// @returns by parse code
async fn fizzbuzz() -> Result<&str> {
  "fizzbuzz"
}
`;

  // WHEN content parsed by tree-sitter grammars
  const funcDocsArray = parseFunctionsAndComments({
    content,
    filePath,
    language,
  });

  // THEN all functions should be detected/parsed by queries
  t.deepEqual(funcDocsArray.length, 4);

  // WHEN new doc comments are written into file content
  for (let i = 0; i < funcDocsArray.length; i += 1) {
    funcDocsArray[i]!.updatedComment = `/// Great new docs
/// @param Eave wrote
/// @return very well`;
  }
  const updatedContent = writeUpdatedCommentsIntoFileString(
    content,
    funcDocsArray,
  );

  // THEN updated file content should be fully documented at correct indentation levels
  const expectedUpdatedContent = `mod app_config;

/// Great new docs
/// @param Eave wrote
/// @return very well
fn foo() {
  println!("foo");
}

pub struct MyClass;

impl MyClass {
  /// Great new docs
  /// @param Eave wrote
  /// @return very well
  pub fn bar(&self) -> &str {
    "bar"
  }
}

/// Great new docs
/// @param Eave wrote
/// @return very well
pub fn baz(): -> &str {
  "baz"
}

/// Great new docs
/// @param Eave wrote
/// @return very well
async fn fizzbuzz() -> Result<&str> {
  "fizzbuzz"
}
`;
  t.deepEqual(updatedContent, expectedUpdatedContent);
});

test("C grammar queries adds/replaces all doc comments correctly", (t) => {
  // GIVEN string content of a file (and language/ext data)
  // (note: function variable string indentation is important; dont adjust to match this file's indentation level)
  const filePath = "src/file.c";
  const language = ProgrammingLanguage.c;
  const content = `#include "./src/config.h";
#include <stdio.h>;

void foo() {
  printf("foo");
}

typedef struct {} MyClass;

char* bar(MyClass* cls) {
  return "bar";
}

char* baz() {
  return "baz";
}

/**
 * Doc comment
 * @param to be replaced
 * @returns by parse code
 */
char* fizzbuzz() {
  return "fizzbuzz";
}
`;

  // WHEN content parsed by tree-sitter grammars
  const funcDocsArray = parseFunctionsAndComments({
    content,
    filePath,
    language,
  });

  // THEN all functions should be detected/parsed by queries
  t.deepEqual(funcDocsArray.length, 4);

  // WHEN new doc comments are written into file content
  for (let i = 0; i < funcDocsArray.length; i += 1) {
    funcDocsArray[i]!.updatedComment = `/**
 * Great new docs
 * @param Eave wrote
 * @return very well
 */`;
  }
  const updatedContent = writeUpdatedCommentsIntoFileString(
    content,
    funcDocsArray,
  );

  // THEN updated file content should be fully documented at correct indentation levels
  const expectedUpdatedContent = `#include "./src/config.h";
#include <stdio.h>;

/**
 * Great new docs
 * @param Eave wrote
 * @return very well
 */
void foo() {
  printf("foo");
}

typedef struct {} MyClass;

/**
 * Great new docs
 * @param Eave wrote
 * @return very well
 */
char* bar(MyClass* cls) {
  return "bar";
}

/**
 * Great new docs
 * @param Eave wrote
 * @return very well
 */
char* baz() {
  return "baz";
}

/**
 * Great new docs
 * @param Eave wrote
 * @return very well
 */
char* fizzbuzz() {
  return "fizzbuzz";
}
`;
  t.deepEqual(updatedContent, expectedUpdatedContent);
});

test("C++ grammar queries adds/replaces all doc comments correctly", (t) => {
  // GIVEN string content of a file (and language/ext data)
  // (note: function variable string indentation is important; dont adjust to match this file's indentation level)
  const filePath = "src/file.cpp";
  const language = ProgrammingLanguage.cpp;
  const content = `#include "./src/config.h";
#include <stdio.h>;

void foo() {
  cout << "foo";
}

typedef struct {} MyClass;

char* bar(MyClass* cls) {
  return "bar";
}

char* baz() {
  return "baz";
}

/**
 * Doc comment
 * @param to be replaced
 * @returns by parse code
 */
char* fizzbuzz() {
  return "fizzbuzz";
}
`;

  // WHEN content parsed by tree-sitter grammars
  const funcDocsArray = parseFunctionsAndComments({
    content,
    filePath,
    language,
  });

  // THEN all functions should be detected/parsed by queries
  t.deepEqual(funcDocsArray.length, 4);

  // WHEN new doc comments are written into file content
  for (let i = 0; i < funcDocsArray.length; i += 1) {
    funcDocsArray[i]!.updatedComment = `/**
 * Great new docs
 * @param Eave wrote
 * @return very well
 */`;
  }
  const updatedContent = writeUpdatedCommentsIntoFileString(
    content,
    funcDocsArray,
  );

  // THEN updated file content should be fully documented at correct indentation levels
  const expectedUpdatedContent = `#include "./src/config.h";
#include <stdio.h>;

/**
 * Great new docs
 * @param Eave wrote
 * @return very well
 */
void foo() {
  cout << "foo";
}

typedef struct {} MyClass;

/**
 * Great new docs
 * @param Eave wrote
 * @return very well
 */
char* bar(MyClass* cls) {
  return "bar";
}

/**
 * Great new docs
 * @param Eave wrote
 * @return very well
 */
char* baz() {
  return "baz";
}

/**
 * Great new docs
 * @param Eave wrote
 * @return very well
 */
char* fizzbuzz() {
  return "fizzbuzz";
}
`;
  t.deepEqual(updatedContent, expectedUpdatedContent);
});

test("Go grammar queries adds/replaces all doc comments correctly", (t) => {
  // GIVEN string content of a file (and language/ext data)
  // (note: function variable string indentation is important; dont adjust to match this file's indentation level)
  const filePath = "src/file.go";
  const language = ProgrammingLanguage.go;
  const content = `package main

import "fmt"

func foo() {
  fmt.Println("foo")
}

type MyClass struct{}

func (mc *MyClass) Bar() string {
  return "bar"
}

func Baz() string {
  return "baz"
}

// Doc comment
// @param to be replaced
// @returns by parse code
func fizzbuzz() string {
  return "fizzbuzz"
}
`;

  // WHEN content parsed by tree-sitter grammars
  const funcDocsArray = parseFunctionsAndComments({
    content,
    filePath,
    language,
  });

  // THEN all functions should be detected/parsed by queries
  t.deepEqual(funcDocsArray.length, 4);

  // WHEN new doc comments are written into file content
  for (let i = 0; i < funcDocsArray.length; i += 1) {
    funcDocsArray[i]!.updatedComment = `// Great new docs
// @param Eave wrote
// @return very well`;
  }
  const updatedContent = writeUpdatedCommentsIntoFileString(
    content,
    funcDocsArray,
  );

  // THEN updated file content should be fully documented at correct indentation levels
  const expectedUpdatedContent = `package main

import "fmt"

// Great new docs
// @param Eave wrote
// @return very well
func foo() {
  fmt.Println("foo")
}

type MyClass struct{}

// Great new docs
// @param Eave wrote
// @return very well
func (mc *MyClass) Bar() string {
  return "bar"
}

// Great new docs
// @param Eave wrote
// @return very well
func Baz() string {
  return "baz"
}

// Great new docs
// @param Eave wrote
// @return very well
func fizzbuzz() string {
  return "fizzbuzz"
}
`;
  t.deepEqual(updatedContent, expectedUpdatedContent);
});

test("Java grammar queries adds/replaces all doc comments correctly", (t) => {
  // GIVEN string content of a file (and language/ext data)
  // (note: function variable string indentation is important; dont adjust to match this file's indentation level)
  const filePath = "src/file.java";
  const language = ProgrammingLanguage.java;
  const content = `import com.src.config;

public class Main {
  static void foo() {
    System.out.println("foo");
  }

  static class MyClass {
    public String bar() {
      return "bar";
    }
  }

  public String baz() {
    return "baz";
  }

  /**
   * Doc comment
   * @param to be replaced
   * @returns by parse code
   */
  public string fizzbuzz() {
    return "fizzbuzz";
  }
}
`;

  // WHEN content parsed by tree-sitter grammars
  const funcDocsArray = parseFunctionsAndComments({
    content,
    filePath,
    language,
  });

  // THEN all functions should be detected/parsed by queries
  t.deepEqual(funcDocsArray.length, 4);

  // WHEN new doc comments are written into file content
  for (let i = 0; i < funcDocsArray.length; i += 1) {
    funcDocsArray[i]!.updatedComment = `/**
 * Great new docs
 * @param Eave wrote
 * @return very well
 */`;
  }
  const updatedContent = writeUpdatedCommentsIntoFileString(
    content,
    funcDocsArray,
  );

  // THEN updated file content should be fully documented at correct indentation levels
  const expectedUpdatedContent = `import com.src.config;

public class Main {
  /**
   * Great new docs
   * @param Eave wrote
   * @return very well
   */
  static void foo() {
    System.out.println("foo");
  }

  static class MyClass {
    /**
     * Great new docs
     * @param Eave wrote
     * @return very well
     */
    public String bar() {
      return "bar";
    }
  }

  /**
   * Great new docs
   * @param Eave wrote
   * @return very well
   */
  public String baz() {
    return "baz";
  }

  /**
   * Great new docs
   * @param Eave wrote
   * @return very well
   */
  public string fizzbuzz() {
    return "fizzbuzz";
  }
}
`;
  t.deepEqual(updatedContent, expectedUpdatedContent);
});

test("Kotlin grammar queries adds/replaces all doc comments correctly", (t) => {
  // GIVEN string content of a file (and language/ext data)
  // (note: function variable string indentation is important; dont adjust to match this file's indentation level)
  const filePath = "src/file.kt";
  const language = ProgrammingLanguage.kotlin;
  const content = `import com.src.config;

fun foo() {
  println("foo")
}

class MyClass {
  public fun bar(): String {
    return "bar"
  }
}

public fun MyClass.baz(): String {
  return "baz"
}

/**
 * Doc comment
 * @param to be replaced
 * @returns by parse code
 */
suspend fun fizzbuzz(): Deferred<String> {
  return 'fizzbuzz';
}
`;

  // WHEN content parsed by tree-sitter grammars
  const funcDocsArray = parseFunctionsAndComments({
    content,
    filePath,
    language,
  });

  // THEN all functions should be detected/parsed by queries
  t.deepEqual(funcDocsArray.length, 4);

  // WHEN new doc comments are written into file content
  for (let i = 0; i < funcDocsArray.length; i += 1) {
    funcDocsArray[i]!.updatedComment = `/**
 * Great new docs
 * @param Eave wrote
 * @return very well
 */`;
  }
  const updatedContent = writeUpdatedCommentsIntoFileString(
    content,
    funcDocsArray,
  );

  // THEN updated file content should be fully documented at correct indentation levels
  const expectedUpdatedContent = `import com.src.config;

/**
 * Great new docs
 * @param Eave wrote
 * @return very well
 */
fun foo() {
  println("foo")
}

class MyClass {
  /**
   * Great new docs
   * @param Eave wrote
   * @return very well
   */
  public fun bar(): String {
    return "bar"
  }
}

/**
 * Great new docs
 * @param Eave wrote
 * @return very well
 */
public fun MyClass.baz(): String {
  return "baz"
}

/**
 * Great new docs
 * @param Eave wrote
 * @return very well
 */
suspend fun fizzbuzz(): Deferred<String> {
  return 'fizzbuzz';
}
`;
  t.deepEqual(updatedContent, expectedUpdatedContent);
});

test("PHP grammar queries adds/replaces all doc comments correctly", (t) => {
  // GIVEN string content of a file (and language/ext data)
  // (note: function variable string indentation is important; dont adjust to match this file's indentation level)
  const filePath = "src/file.php";
  const language = ProgrammingLanguage.php;
  const content = `<?php

namespace Main/NameSpace;

function foo() {
  echo "foo";
}

class MyClass {
  public function bar() {
    return "bar";
  }
}

public function baz() {
  return "baz";
}

/**
 * Doc comment
 * @param to be replaced
 * @returns by parse code
 */
function fizzbuzz() {
  return "fizzbuzz";
}
`;

  // WHEN content parsed by tree-sitter grammars
  const funcDocsArray = parseFunctionsAndComments({
    content,
    filePath,
    language,
  });

  // THEN all functions should be detected/parsed by queries
  t.deepEqual(funcDocsArray.length, 4);

  // WHEN new doc comments are written into file content
  for (let i = 0; i < funcDocsArray.length; i += 1) {
    funcDocsArray[i]!.updatedComment = `/**
 * Great new docs
 * @param Eave wrote
 * @return very well
 */`;
  }
  const updatedContent = writeUpdatedCommentsIntoFileString(
    content,
    funcDocsArray,
  );

  // THEN updated file content should be fully documented at correct indentation levels
  const expectedUpdatedContent = `<?php

namespace Main/NameSpace;

/**
 * Great new docs
 * @param Eave wrote
 * @return very well
 */
function foo() {
  echo "foo";
}

class MyClass {
  /**
   * Great new docs
   * @param Eave wrote
   * @return very well
   */
  public function bar() {
    return "bar";
  }
}

/**
 * Great new docs
 * @param Eave wrote
 * @return very well
 */
public function baz() {
  return "baz";
}

/**
 * Great new docs
 * @param Eave wrote
 * @return very well
 */
function fizzbuzz() {
  return "fizzbuzz";
}
`;
  t.deepEqual(updatedContent, expectedUpdatedContent);
});

test("Ruby grammar queries adds/replaces all doc comments correctly", (t) => {
  // GIVEN string content of a file (and language/ext data)
  // (note: function variable string indentation is important; dont adjust to match this file's indentation level)
  const filePath = "src/file.rb";
  const language = ProgrammingLanguage.ruby;
  const content = `require "./src/config.js";

def foo
  puts "foo"
end

class MyClass
  def bar
    "bar"
  end
end

def baz
  "baz"
end

# Doc comment
# @param to be replaced
# @returns by parse code
def fizzbuzz
  "fizzbuzz"
end
`;

  // WHEN content parsed by tree-sitter grammars
  const funcDocsArray = parseFunctionsAndComments({
    content,
    filePath,
    language,
  });

  // THEN all functions should be detected/parsed by queries
  t.deepEqual(funcDocsArray.length, 4);

  // WHEN new doc comments are written into file content
  for (let i = 0; i < funcDocsArray.length; i += 1) {
    funcDocsArray[i]!.updatedComment = `# Great new docs
# @param Eave wrote
# @return very well`;
  }
  const updatedContent = writeUpdatedCommentsIntoFileString(
    content,
    funcDocsArray,
  );

  // THEN updated file content should be fully documented at correct indentation levels
  const expectedUpdatedContent = `require "./src/config.js";

# Great new docs
# @param Eave wrote
# @return very well
def foo
  puts "foo"
end

class MyClass
  # Great new docs
  # @param Eave wrote
  # @return very well
  def bar
    "bar"
  end
end

# Great new docs
# @param Eave wrote
# @return very well
def baz
  "baz"
end

# Great new docs
# @param Eave wrote
# @return very well
def fizzbuzz
  "fizzbuzz"
end
`;
  t.deepEqual(updatedContent, expectedUpdatedContent);
});

test("Swift grammar queries adds/replaces all doc comments correctly", (t) => {
  // GIVEN string content of a file (and language/ext data)
  // (note: function variable string indentation is important; dont adjust to match this file's indentation level)
  const filePath = "src/file.swift";
  const language = ProgrammingLanguage.swift;
  const content = `import Config

func foo() {
  print("foo")
}

class MyClass {
  public func bar() -> String {
    return "bar"
  }
}

public extension MyClass {
  func baz() -> String {
    return "baz"
  }
}

/// Doc comment
/// @param to be replaced
/// @returns by parse code
func fizzbuzz() -> String {
  return "fizzbuzz"
}
`;

  // WHEN content parsed by tree-sitter grammars
  const funcDocsArray = parseFunctionsAndComments({
    content,
    filePath,
    language,
  });

  // THEN all functions should be detected/parsed by queries
  t.deepEqual(funcDocsArray.length, 4);

  // WHEN new doc comments are written into file content
  for (let i = 0; i < funcDocsArray.length; i += 1) {
    funcDocsArray[i]!.updatedComment = `/// Great new docs
/// @param Eave wrote
/// @return very well`;
  }
  const updatedContent = writeUpdatedCommentsIntoFileString(
    content,
    funcDocsArray,
  );

  // THEN updated file content should be fully documented at correct indentation levels
  const expectedUpdatedContent = `import Config

/// Great new docs
/// @param Eave wrote
/// @return very well
func foo() {
  print("foo")
}

class MyClass {
  /// Great new docs
  /// @param Eave wrote
  /// @return very well
  public func bar() -> String {
    return "bar"
  }
}

public extension MyClass {
  /// Great new docs
  /// @param Eave wrote
  /// @return very well
  func baz() -> String {
    return "baz"
  }
}

/// Great new docs
/// @param Eave wrote
/// @return very well
func fizzbuzz() -> String {
  return "fizzbuzz"
}
`;
  t.deepEqual(updatedContent, expectedUpdatedContent);
});

test("C# grammar queries adds/replaces all doc comments correctly", (t) => {
  // GIVEN string content of a file (and language/ext data)
  // (note: function variable string indentation is important; dont adjust to match this file's indentation level)
  const filePath = "src/file.cs";
  const language = ProgrammingLanguage.csharp;
  const content = `using System;

namespace MyNamespace
{
  class Main
  {
    static void foo()
    {
      Console.WriteLine("foo");
    }

    class MyClass
    {
      public string bar()
      {
        return "bar";
      }
    }

    public string baz()
    {
      return "baz";
    }

    /// <summary>
    /// Doc comment
    /// @param to be replaced
    /// @returns by parse code
    /// </summary>
    public async Task<string> fizzbuzz()
    {
      return "fizzbuzz";
    }
  }
}
`;

  // WHEN content parsed by tree-sitter grammars
  const funcDocsArray = parseFunctionsAndComments({
    content,
    filePath,
    language,
  });

  // THEN all functions should be detected/parsed by queries
  t.deepEqual(funcDocsArray.length, 4);

  // WHEN new doc comments are written into file content
  for (let i = 0; i < funcDocsArray.length; i += 1) {
    funcDocsArray[i]!.updatedComment = `/// <summary>
/// Great new docs
/// @param Eave wrote
/// @return very well
/// </summary>`;
  }
  const updatedContent = writeUpdatedCommentsIntoFileString(
    content,
    funcDocsArray,
  );

  // THEN updated file content should be fully documented at correct indentation levels
  const expectedUpdatedContent = `using System;

namespace MyNamespace
{
  class Main
  {
    /// <summary>
    /// Great new docs
    /// @param Eave wrote
    /// @return very well
    /// </summary>
    static void foo()
    {
      Console.WriteLine("foo");
    }

    class MyClass
    {
      /// <summary>
      /// Great new docs
      /// @param Eave wrote
      /// @return very well
      /// </summary>
      public string bar()
      {
        return "bar";
      }
    }

    /// <summary>
    /// Great new docs
    /// @param Eave wrote
    /// @return very well
    /// </summary>
    public string baz()
    {
      return "baz";
    }

    /// <summary>
    /// Great new docs
    /// @param Eave wrote
    /// @return very well
    /// </summary>
    public async Task<string> fizzbuzz()
    {
      return "fizzbuzz";
    }
  }
}
`;
  t.deepEqual(updatedContent, expectedUpdatedContent);
});

test("assertValidSyntax throws on syntax error in content", async (t) => {
  // GIVEN string content of a file is syntactically invalid
  const filePath = "src/file.ts";
  const language = ProgrammingLanguage.typescript;
  const content = `import { appConfig } from './src/config.js';

function foo() {
  conslaw.log('weee");
}

classMyClass {
  bar(): string _> oops all beans {
    return "bar";;;;;
  }
}

export function baz(): string {
  return HAHWWHAW!!!!???
}

// the following is actually ok with tree-sitter T.T
\`\`\`
/**
 * Doc comment
 * @param to be replaced
 * @returns by parse code
 */
\`\`\`
async function fizzbuzz(): Promise<string> {
  return 'fizzbuzz';
}
`;

  // WHEN syntax validity is checked
  try {
    const funcDocsArray = assertValidSyntax({
      content,
      filePath,
    });

    t.fail("assertValidSyntax did not throw for invalid content");
  } catch {
    // THEN it should throw an error
    t.pass();
  }
});

test("assertValidSyntax does not throw on syntactically correct content", async (t) => {
  // GIVEN string content of a file is syntactically valid
  const filePath = "src/file.ts";
  const language = ProgrammingLanguage.typescript;
  const content = `import { appConfig } from './src/config.js';

  function foo() {
    console.log('foo');
  }

  class MyClass {
    bar(): string {
      return "bar";
    }
  }

  export function baz(): string {
    return "baz";
  }

  /**
   * Doc comment
   * @param to be replaced
   * @returns by parse code
   */
  async function fizzbuzz(): Promise<string> {
    return 'fizzbuzz';
  }
  `;

  // WHEN syntax validity is checked
  try {
    const funcDocsArray = assertValidSyntax({
      content,
      filePath,
    });

    // THEN it should not throw an error
    t.pass();
  } catch {
    t.fail("assertValidSyntax did not throw for invalid content");
  }
});

test("multi-line comments that aren't neighboring aren't joined", (t) => {
  // GIVEN string content of a file where 2 comment nodes are neighbors in the
  // AST but not in actual code lines, and one comment is multi-line
  // (note: function variable string indentation is important; dont adjust to match this file's indentation level)
  const filePath = "src/file.ts";
  const language = ProgrammingLanguage.typescript;
  const content = `import { appConfig } from './src/config.js';
import * as T from '../file.js';

/*
Just a header comment
*/

/**
 * Doc comment
 * @param to be replaced
 * @returns by parse code
 */
function foo() {
  console.log('foo');
}
`;

  // WHEN content parsed by tree-sitter grammars
  const funcDocsArray = parseFunctionsAndComments({
    content,
    filePath,
    language,
  });

  // THEN all functions should be detected/parsed by queries
  t.deepEqual(funcDocsArray.length, 1);

  // WHEN new doc comments are written into file content
  for (let i = 0; i < funcDocsArray.length; i += 1) {
    funcDocsArray[i]!.updatedComment = `/**
 * Great new docs
 * @param Eave wrote
 * @return very well
 */`;
  }
  const updatedContent = writeUpdatedCommentsIntoFileString(
    content,
    funcDocsArray,
  );

  // THEN updated file content should keep the comments separate
  const expectedUpdatedContent = `import { appConfig } from './src/config.js';
import * as T from '../file.js';

/*
Just a header comment
*/

/**
 * Great new docs
 * @param Eave wrote
 * @return very well
 */
function foo() {
  console.log('foo');
}
`;
  t.deepEqual(updatedContent, expectedUpdatedContent);
});

test("single-line comments that aren't neighboring aren't joined", (t) => {
  // GIVEN string content of a file where 2 comment nodes are neighbors in the
  // AST but not in actual code lines, and one comment is single-line
  // (note: function variable string indentation is important; dont adjust to match this file's indentation level)
  const filePath = "src/file.ts";
  const language = ProgrammingLanguage.typescript;
  const content = `import { appConfig } from './src/config.js';
import * as T from '../file.js'; // eslint-disable-line no-unused-vars

// unusual single line js doc comment
// @param to be replaced
// @returns by parse code
function foo() {
  console.log('foo');
}
`;

  // WHEN content parsed by tree-sitter grammars
  const funcDocsArray = parseFunctionsAndComments({
    content,
    filePath,
    language,
  });

  // THEN all functions should be detected/parsed by queries
  t.deepEqual(funcDocsArray.length, 1);

  // WHEN new doc comments are written into file content
  for (let i = 0; i < funcDocsArray.length; i += 1) {
    funcDocsArray[i]!.updatedComment = `/**
 * Great new docs
 * @param Eave wrote
 * @return very well
 */`;
  }
  const updatedContent = writeUpdatedCommentsIntoFileString(
    content,
    funcDocsArray,
  );

  // THEN updated file content should keep the comments separate
  const expectedUpdatedContent = `import { appConfig } from './src/config.js';
import * as T from '../file.js'; // eslint-disable-line no-unused-vars

/**
 * Great new docs
 * @param Eave wrote
 * @return very well
 */
function foo() {
  console.log('foo');
}
`;
  t.deepEqual(updatedContent, expectedUpdatedContent);
});
