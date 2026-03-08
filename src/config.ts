import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_TEST_INCLUDE } from "./constants.js";
import type { TestPatternResolution } from "./types.js";

const CONFIG_CANDIDATES = [
  "vitest.config.ts",
  "vitest.config.mts",
  "vitest.config.cts",
  "vitest.config.js",
  "vitest.config.mjs",
  "vitest.config.cjs",
];

function unescapeStringValue(value: string): string {
  try {
    return JSON.parse(`"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);
  } catch {
    return value;
  }
}

interface ParsedStringArray {
  found: boolean;
  values: string[];
}

function isIdentifierChar(ch: string | undefined): boolean {
  return Boolean(ch && /[A-Za-z0-9_$]/.test(ch));
}

function skipWhitespace(source: string, from: number): number {
  let index = from;
  while (index < source.length && /\s/.test(source[index])) {
    index += 1;
  }
  return index;
}

function extractTopLevelArrayBody(source: string, key: string): string | undefined {
  let braceDepth = 0;
  let state: "code" | "single" | "double" | "template" | "lineComment" | "blockComment" = "code";
  let escaped = false;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];

    if (state === "lineComment") {
      if (ch === "\n") {
        state = "code";
      }
      continue;
    }

    if (state === "blockComment") {
      if (ch === "*" && next === "/") {
        state = "code";
        i += 1;
      }
      continue;
    }

    if (state === "single") {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "'") {
        state = "code";
      }
      continue;
    }

    if (state === "double") {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        state = "code";
      }
      continue;
    }

    if (state === "template") {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "`") {
        state = "code";
      }
      continue;
    }

    if (ch === "/" && next === "/") {
      state = "lineComment";
      i += 1;
      continue;
    }

    if (ch === "/" && next === "*") {
      state = "blockComment";
      i += 1;
      continue;
    }

    if (ch === "'") {
      state = "single";
      continue;
    }

    if (ch === '"') {
      state = "double";
      continue;
    }

    if (ch === "`") {
      state = "template";
      continue;
    }

    if (ch === "{") {
      braceDepth += 1;
      continue;
    }

    if (ch === "}") {
      braceDepth = Math.max(0, braceDepth - 1);
      continue;
    }

    if (braceDepth > 0 || !source.startsWith(key, i)) {
      continue;
    }

    if (isIdentifierChar(source[i - 1]) || isIdentifierChar(source[i + key.length])) {
      continue;
    }

    let cursor = skipWhitespace(source, i + key.length);
    if (source[cursor] !== ":") {
      continue;
    }

    cursor = skipWhitespace(source, cursor + 1);
    if (source[cursor] !== "[") {
      continue;
    }

    const bodyStart = cursor + 1;
    let bracketDepth = 1;
    let arrayState: "code" | "single" | "double" | "template" | "lineComment" | "blockComment" =
      "code";
    let arrayEscaped = false;

    for (let j = bodyStart; j < source.length; j += 1) {
      const arrayCh = source[j];
      const arrayNext = source[j + 1];

      if (arrayState === "lineComment") {
        if (arrayCh === "\n") {
          arrayState = "code";
        }
        continue;
      }

      if (arrayState === "blockComment") {
        if (arrayCh === "*" && arrayNext === "/") {
          arrayState = "code";
          j += 1;
        }
        continue;
      }

      if (arrayState === "single") {
        if (arrayEscaped) {
          arrayEscaped = false;
        } else if (arrayCh === "\\") {
          arrayEscaped = true;
        } else if (arrayCh === "'") {
          arrayState = "code";
        }
        continue;
      }

      if (arrayState === "double") {
        if (arrayEscaped) {
          arrayEscaped = false;
        } else if (arrayCh === "\\") {
          arrayEscaped = true;
        } else if (arrayCh === '"') {
          arrayState = "code";
        }
        continue;
      }

      if (arrayState === "template") {
        if (arrayEscaped) {
          arrayEscaped = false;
        } else if (arrayCh === "\\") {
          arrayEscaped = true;
        } else if (arrayCh === "`") {
          arrayState = "code";
        }
        continue;
      }

      if (arrayCh === "/" && arrayNext === "/") {
        arrayState = "lineComment";
        j += 1;
        continue;
      }

      if (arrayCh === "/" && arrayNext === "*") {
        arrayState = "blockComment";
        j += 1;
        continue;
      }

      if (arrayCh === "'") {
        arrayState = "single";
        continue;
      }

      if (arrayCh === '"') {
        arrayState = "double";
        continue;
      }

      if (arrayCh === "`") {
        arrayState = "template";
        continue;
      }

      if (arrayCh === "[") {
        bracketDepth += 1;
        continue;
      }

      if (arrayCh === "]") {
        bracketDepth -= 1;
        if (bracketDepth === 0) {
          return source.slice(bodyStart, j);
        }
      }
    }
  }

  return undefined;
}

function parseStringArray(source: string, key: string): ParsedStringArray {
  const listBody = extractTopLevelArrayBody(source, key);
  if (listBody === undefined) {
    return { found: false, values: [] };
  }

  const values: string[] = [];
  const stringRegex = /(['"`])((?:\\.|(?!\1).)*)\1/g;
  let match = stringRegex.exec(listBody);

  while (match) {
    values.push(unescapeStringValue(match[2]));
    match = stringRegex.exec(listBody);
  }

  return { found: true, values };
}

function extractTestBlock(source: string): string | undefined {
  const testMatch = source.match(/\btest\s*:\s*{/m);
  if (!testMatch || testMatch.index === undefined) {
    return undefined;
  }

  let depth = 0;
  let start = -1;
  let state: "code" | "single" | "double" | "template" = "code";
  let escaped = false;

  for (let i = testMatch.index; i < source.length; i += 1) {
    const ch = source[i];

    if (state === "single") {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "'") {
        state = "code";
      }
      continue;
    }

    if (state === "double") {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        state = "code";
      }
      continue;
    }

    if (state === "template") {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "`") {
        state = "code";
      }
      continue;
    }

    if (ch === "'") {
      state = "single";
      continue;
    }

    if (ch === '"') {
      state = "double";
      continue;
    }

    if (ch === "`") {
      state = "template";
      continue;
    }

    if (ch === "{") {
      if (start < 0) {
        start = i + 1;
      }
      depth += 1;
      continue;
    }

    if (ch === "}") {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        return source.slice(start, i);
      }
    }
  }

  return undefined;
}

async function readExistingConfigPath(cwd: string): Promise<string | null> {
  for (const name of CONFIG_CANDIDATES) {
    const filePath = path.join(cwd, name);
    try {
      await access(filePath);
      return filePath;
    } catch {
      // Move to next candidate.
    }
  }

  return null;
}

export async function resolveTestPatterns(cwd: string): Promise<TestPatternResolution> {
  const configPath = await readExistingConfigPath(cwd);
  if (!configPath) {
    return {
      include: DEFAULT_TEST_INCLUDE,
      exclude: [],
      configPath: null,
      usedConfigPatterns: false,
    };
  }

  try {
    const source = await readFile(configPath, "utf8");
    const testBlock = extractTestBlock(source);
    const include = parseStringArray(testBlock ?? source, "include");
    const exclude = parseStringArray(testBlock ?? source, "exclude");
    const usedConfigPatterns = include.found || exclude.found;

    return {
      include: include.found ? include.values : DEFAULT_TEST_INCLUDE,
      exclude: exclude.found ? exclude.values : [],
      configPath,
      usedConfigPatterns,
    };
  } catch {
    return {
      include: DEFAULT_TEST_INCLUDE,
      exclude: [],
      configPath,
      usedConfigPatterns: false,
    };
  }
}
