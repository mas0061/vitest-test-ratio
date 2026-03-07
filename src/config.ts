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

function parseStringArray(source: string, key: string): ParsedStringArray {
  const arrayMatch = source.match(new RegExp(`\\b${key}\\s*:\\s*\\[([\\s\\S]*?)\\]`, "m"));
  if (!arrayMatch) {
    return { found: false, values: [] };
  }

  const listBody = arrayMatch[1];
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
