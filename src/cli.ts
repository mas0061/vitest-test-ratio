#!/usr/bin/env node
import { realpathSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { analyzeProject } from "./analyzer.js";
import { formatTextReport, selectTopEntries, sortFileEntries } from "./format.js";
import type { AnalysisResult } from "./types.js";

interface CliOptions {
  cwd: string;
  files: boolean;
  top?: number;
  json: boolean;
  help: boolean;
}

function usage(): string {
  return [
    "Usage: vitest-test-ratio [options]",
    "",
    "Options:",
    "  --files        Show per-file ratio entries",
    "  --top <n>      Show top N files by Code LOC (implies --files)",
    "  --json         Output machine-readable JSON",
    "  --cwd <path>   Analyze a specific directory (default: current directory)",
    "  -h, --help     Show help",
  ].join("\n");
}

function parsePositiveInt(value: string, flagName: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flagName} must be a positive integer`);
  }
  return parsed;
}

function parseArgValue(args: string[], index: number, flagName: string): string {
  const inlineEqIndex = args[index].indexOf("=");
  if (inlineEqIndex >= 0) {
    return args[index].slice(inlineEqIndex + 1);
  }

  const next = args[index + 1];
  if (!next || next.startsWith("-")) {
    throw new Error(`${flagName} requires a value`);
  }
  return next;
}

export function parseArgs(argv: string[]): CliOptions {
  let cwd = process.cwd();
  let files = false;
  let top: number | undefined;
  let json = false;
  let help = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--files") {
      files = true;
      continue;
    }

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "-h" || arg === "--help") {
      help = true;
      continue;
    }

    if (arg === "--top" || arg.startsWith("--top=")) {
      const value = parseArgValue(argv, i, "--top");
      top = parsePositiveInt(value, "--top");
      files = true;
      if (!arg.includes("=")) {
        i += 1;
      }
      continue;
    }

    if (arg === "--cwd" || arg.startsWith("--cwd=")) {
      const value = parseArgValue(argv, i, "--cwd");
      cwd = path.resolve(value);
      if (!arg.includes("=")) {
        i += 1;
      }
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { cwd, files, top, json, help };
}

function applyTop(result: AnalysisResult, top?: number): AnalysisResult {
  if (!top) {
    return result;
  }

  const sorted = sortFileEntries(result.files);
  const limited = selectTopEntries(sorted, top);
  return {
    project: result.project,
    files: limited,
  };
}

export async function runCli(
  argv: string[],
  io: { stdout: { write: (text: string) => void }; stderr: { write: (text: string) => void } } = {
    stdout: process.stdout,
    stderr: process.stderr,
  },
): Promise<number> {
  try {
    const options = parseArgs(argv);
    if (options.help) {
      io.stdout.write(`${usage()}\n`);
      return 0;
    }

    const analysis = await analyzeProject({ cwd: options.cwd });
    const withTop = applyTop(analysis, options.top);

    if (options.json) {
      io.stdout.write(`${JSON.stringify(withTop, null, 2)}\n`);
      return 0;
    }

    const report = formatTextReport(withTop, { includeFiles: options.files, top: options.top });
    io.stdout.write(`${report}\n`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.stderr.write(`${message}\n`);
    return 1;
  }
}

export function shouldRunAsMain(importMetaUrl: string, argv1: string | undefined): boolean {
  if (!argv1) {
    return false;
  }

  try {
    return importMetaUrl === pathToFileURL(realpathSync(argv1)).href;
  } catch {
    return false;
  }
}

if (shouldRunAsMain(import.meta.url, process.argv[1])) {
  runCli(process.argv.slice(2)).then((exitCode) => {
    if (exitCode !== 0) {
      process.exitCode = exitCode;
    }
  });
}
