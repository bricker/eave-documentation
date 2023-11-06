import assert from "node:assert";

export function redact(str?: string, length = 8): string | undefined {
  if (str === undefined) {
    return undefined;
  }

  const strlen = str.length;
  if (strlen <= length) {
    return `[redacted ${strlen} chars]`;
  }

  // This effectively turns an odd number into an even number, so we don't have to deal with floats
  const slicelen = Math.floor(length / 2);
  return `${str.slice(0, slicelen)}[redacted ${
    strlen - slicelen * 2
  } chars]${str.slice(-slicelen)}`;
}

export function enumCases<O extends object>(
  obj: O,
): Array<NonNullable<O[keyof O]>> {
  return Object.keys(obj).reduce((acc, key, _) => {
    const candidateCase = obj[key as keyof typeof obj];
    // only add the enum case named keys (i.e. not numbers)
    // so exclude obj keys that dont get parsed to NaN
    if (candidateCase && Number.isNaN(parseInt(key, 10))) {
      acc.push(candidateCase);
    }
    return acc;
  }, Array<NonNullable<O[keyof O]>>());
}

export function xor(a: any, b: any): boolean {
  return !!a !== !!b;
}

export function normalizeExtName(extName: string): string {
  // quality-of-life (also to prevent bugs): Accept extension with or without leading dot
  if (extName.at(0) === ".") {
    return extName;
  } else {
    return `.${extName}`;
  }
}

export function assertPresence<T>(
  v: T | undefined | null,
  msg?: string,
): asserts v is T {
  assert(v !== undefined, msg || "Unexpected undefined value");
  assert(v !== null, msg || "Unexpected null value");
}

export function titleize(str: string) {
  return str
    .split(" ")
    .filter((s) => s.length > 0)
    .map((s) => s.at(0)!.toUpperCase() + s.slice(1))
    .join(" ");
}

export function underscoreify(str: string) {
  return str.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
}

export function dedent(s: string): string {
  let chunks = s.split("\n");
  if (chunks.length <= 1) {
    // not a multiline string; nothing to dedent
    return s;
  }

  const commonLeadingWhitespaceLength = chunks.reduce((len, line) => {
    // Ignore empty lines
    if (line.trim().length === 0) {
      return len;
    }

    const m = line.match(/^\s*/);
    const lws = m![0].length;
    if (lws < len) {
      len = lws;
    }
    return len;
  }, Infinity);

  if (commonLeadingWhitespaceLength === Infinity) {
    // Common whitespace couldn't be determined; return the original string.
    return s;
  }

  chunks = chunks.map((line) => line.slice(commonLeadingWhitespaceLength));
  return chunks.join("\n");
}

export function makeString(data: any): string {
  if (typeof data === "string") {
    return data;
  } else if (data instanceof Buffer) {
    return data.toString();
  } else {
    return JSON.stringify(data);
  }
}
