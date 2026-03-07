import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
type SlocStats = { source?: number };
type SlocCounter = (sourceCode: string, language: string) => SlocStats;
const slocCounter = require("sloc") as SlocCounter;

enum ParseState {
  Code = 0,
  SingleQuoteString = 1,
  DoubleQuoteString = 2,
  TemplateString = 3,
  LineComment = 4,
  BlockComment = 5,
}

function stripComments(input: string): string {
  let output = "";
  let state = ParseState.Code;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    const next = input[i + 1];
    const prev = input[i - 1];

    if (state === ParseState.LineComment) {
      if (ch === "\n") {
        output += ch;
        state = ParseState.Code;
      }
      continue;
    }

    if (state === ParseState.BlockComment) {
      if (ch === "\n") {
        output += "\n";
        continue;
      }

      if (ch === "*" && next === "/") {
        state = ParseState.Code;
        i += 1;
      }
      continue;
    }

    if (state === ParseState.SingleQuoteString) {
      output += ch;
      if (ch === "'" && prev !== "\\") {
        state = ParseState.Code;
      }
      continue;
    }

    if (state === ParseState.DoubleQuoteString) {
      output += ch;
      if (ch === '"' && prev !== "\\") {
        state = ParseState.Code;
      }
      continue;
    }

    if (state === ParseState.TemplateString) {
      output += ch;
      if (ch === "`" && prev !== "\\") {
        state = ParseState.Code;
      }
      continue;
    }

    if (ch === "/" && next === "/") {
      state = ParseState.LineComment;
      i += 1;
      continue;
    }

    if (ch === "/" && next === "*") {
      state = ParseState.BlockComment;
      i += 1;
      continue;
    }

    if (ch === "'") {
      output += ch;
      state = ParseState.SingleQuoteString;
      continue;
    }

    if (ch === '"') {
      output += ch;
      state = ParseState.DoubleQuoteString;
      continue;
    }

    if (ch === "`") {
      output += ch;
      state = ParseState.TemplateString;
      continue;
    }

    output += ch;
  }

  return output;
}

function countLocFallback(content: string): number {
  const stripped = stripComments(content);
  return stripped
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0).length;
}

const EXT_TO_SLOC_LANGUAGE: Record<string, string> = {
  ".js": "js",
  ".jsx": "jsx",
  ".ts": "ts",
  ".tsx": "tsx",
};

function languageFromFilePath(filePath?: string): string | undefined {
  if (!filePath) {
    return undefined;
  }
  const ext = path.extname(filePath).toLowerCase();
  return EXT_TO_SLOC_LANGUAGE[ext];
}

export function countLoc(content: string, filePath?: string): number {
  const language = languageFromFilePath(filePath);
  if (!language) {
    return countLocFallback(content);
  }

  try {
    const stats = slocCounter(content, language);
    if (typeof stats.source === "number") {
      return stats.source;
    }
  } catch {
    // Fallback is intentionally lightweight and resilient.
  }

  return countLocFallback(content);
}
