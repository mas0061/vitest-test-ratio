import { readFile } from "node:fs/promises";
import path from "node:path";
import { glob } from "tinyglobby";
import { resolveTestPatterns } from "./config.js";
import { GLOBAL_IGNORE_PATTERNS } from "./constants.js";
import { formatRatio, getRatio } from "./format.js";
import { countLoc } from "./loc.js";
import type { AnalysisResult, AnalyzeOptions, FileRatioEntry } from "./types.js";
import {
  hasSupportedSourceExtension,
  isDeclarationFile,
  normalizeTestBaseName,
  toPosixPath,
} from "./utils.js";

interface TestLocRecord {
  testPath: string;
  loc: number;
}

async function readFileLoc(cwd: string, relativePath: string): Promise<number> {
  const fullPath = path.join(cwd, relativePath);
  const content = await readFile(fullPath, "utf8");
  return countLoc(content, relativePath);
}

function isIgnoredDeclaration(filePath: string): boolean {
  return isDeclarationFile(filePath) || filePath.endsWith(".d.mts") || filePath.endsWith(".d.cts");
}

function uniqSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export async function analyzeProject(options: AnalyzeOptions): Promise<AnalysisResult> {
  const cwd = path.resolve(options.cwd);
  const patternResolution = await resolveTestPatterns(cwd);

  const testPaths = uniqSorted(
    (
      await glob(patternResolution.include, {
        cwd,
        onlyFiles: true,
        ignore: [...GLOBAL_IGNORE_PATTERNS, ...patternResolution.exclude],
      })
    )
      .map(toPosixPath)
      .filter(hasSupportedSourceExtension)
      .filter((filePath) => !isIgnoredDeclaration(filePath)),
  );

  const allSourceCandidates = uniqSorted(
    (
      await glob(["**/*.{ts,tsx,js,jsx}"], {
        cwd,
        onlyFiles: true,
        ignore: [
          ...GLOBAL_IGNORE_PATTERNS,
          "**/*.test.{ts,tsx,js,jsx}",
          "**/*.spec.{ts,tsx,js,jsx}",
          "**/*.d.ts",
          "**/*.d.cts",
          "**/*.d.mts",
          "**/vitest.config.{ts,mts,cts,js,mjs,cjs}",
          "**/vitest.workspace.{ts,mts,cts,js,mjs,cjs}",
          "**/vite.config.{ts,mts,cts,js,mjs,cjs}",
        ],
      })
    ).map(toPosixPath),
  );

  const testSet = new Set(testPaths);
  const sourcePaths = allSourceCandidates.filter((filePath) => !testSet.has(filePath));

  const sourceLocPairs = await Promise.all(
    sourcePaths.map(
      async (sourcePath) => [sourcePath, await readFileLoc(cwd, sourcePath)] as const,
    ),
  );
  const testLocPairs = await Promise.all(
    testPaths.map(async (testPath) => [testPath, await readFileLoc(cwd, testPath)] as const),
  );

  const testByBaseName = new Map<string, TestLocRecord[]>();
  for (const [testPath, loc] of testLocPairs) {
    const key = normalizeTestBaseName(testPath).toLowerCase();
    const list = testByBaseName.get(key) ?? [];
    list.push({ testPath, loc });
    testByBaseName.set(key, list);
  }

  const files: FileRatioEntry[] = sourceLocPairs.map(([source, codeLoc]) => {
    const key = normalizeTestBaseName(source).toLowerCase();
    const matchedTests = testByBaseName.get(key) ?? [];
    const matchedTestPaths = matchedTests
      .map((item) => item.testPath)
      .sort((a, b) => a.localeCompare(b));
    const testLoc = matchedTests.reduce((sum, item) => sum + item.loc, 0);
    const ratio = matchedTests.length === 0 ? null : getRatio(codeLoc, testLoc);

    return {
      source,
      codeLoc,
      testLoc,
      ratio,
      ratioFormatted: ratio === null ? null : formatRatio(ratio),
      matchedTests: matchedTestPaths,
    };
  });

  const projectCodeLoc = sourceLocPairs.reduce((sum, [, loc]) => sum + loc, 0);
  const projectTestLoc = testLocPairs.reduce((sum, [, loc]) => sum + loc, 0);
  const projectRatio = getRatio(projectCodeLoc, projectTestLoc);

  return {
    project: {
      codeLoc: projectCodeLoc,
      testLoc: projectTestLoc,
      ratio: projectRatio,
      ratioFormatted: formatRatio(projectRatio),
      unmatchedFiles: files.filter((file) => file.matchedTests.length === 0).length,
    },
    files,
  };
}
