import type { AnalysisResult, FileRatioEntry } from "./types.js";

function roundRatio(ratio: number): number {
  return Number(ratio.toFixed(6));
}

export function getRatio(codeLoc: number, testLoc: number): number | null {
  if (codeLoc <= 0) {
    return null;
  }
  const rawRatio = testLoc / codeLoc;
  const cappedRatio = Math.min(rawRatio, 2);
  return roundRatio(cappedRatio);
}

export function formatRatio(ratio: number | null): string {
  if (ratio === null) {
    return "N/A";
  }
  return `1:${ratio.toFixed(2)}`;
}

export function sortFileEntries(entries: FileRatioEntry[]): FileRatioEntry[] {
  return [...entries].sort((a, b) => a.source.localeCompare(b.source));
}

export function selectTopEntries(entries: FileRatioEntry[], top?: number): FileRatioEntry[] {
  if (!top || top < 1) {
    return entries;
  }
  return entries.slice(0, top);
}

export function formatSummaryLine(result: AnalysisResult): string {
  return [
    `Code LOC: ${result.project.codeLoc}`,
    `Test LOC: ${result.project.testLoc}`,
    `Code to Test Ratio: ${result.project.ratioFormatted}`,
    `Unmatched files: ${result.project.unmatchedFiles}`,
  ].join("     ");
}

function formatFileLine(entry: FileRatioEntry): string {
  const matchLabel =
    entry.matchedTests.length > 0 ? entry.matchedTests.join(", ") : "No matching test";
  const ratio = entry.ratioFormatted ?? "N/A";

  return [
    entry.source,
    `Code LOC: ${entry.codeLoc}`,
    `Test LOC: ${entry.testLoc}`,
    `Ratio: ${ratio}`,
    matchLabel,
  ].join("     ");
}

export function formatTextReport(
  result: AnalysisResult,
  options: { includeFiles: boolean; top?: number },
): string {
  const lines = [formatSummaryLine(result)];
  if (!options.includeFiles) {
    return lines.join("\n");
  }

  const sorted = sortFileEntries(result.files);
  const selected = selectTopEntries(sorted, options.top);
  lines.push("");
  lines.push("Files:");
  lines.push(...selected.map(formatFileLine));
  return lines.join("\n");
}
