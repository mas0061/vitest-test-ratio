import { describe, expect, it } from "vitest";
import {
  formatRatio,
  formatSummaryLine,
  formatTextReport,
  getRatio,
  selectTopEntries,
  sortFileEntries,
} from "../src/format.js";
import type { AnalysisResult, FileRatioEntry } from "../src/types.js";

describe("format helpers", () => {
  it("calculates ratio and caps it at 1:2", () => {
    expect(getRatio(10, 5)).toBe(0.5);
    expect(getRatio(10, 20)).toBe(2);
    expect(getRatio(10, 40)).toBe(2);
    expect(getRatio(0, 10)).toBeNull();
  });

  it("formats ratio for display", () => {
    expect(formatRatio(null)).toBe("N/A");
    expect(formatRatio(0.5)).toBe("1:0.50");
    expect(formatRatio(2)).toBe("1:2.00");
  });

  it("sorts per-file entries alphabetically by source", () => {
    const entries: FileRatioEntry[] = [
      {
        source: "src/zeta.ts",
        codeLoc: 3,
        testLoc: 0,
        ratio: null,
        ratioFormatted: null,
        matchedTests: [],
      },
      {
        source: "src/alpha.ts",
        codeLoc: 1,
        testLoc: 1,
        ratio: 1,
        ratioFormatted: "1:1.00",
        matchedTests: ["tests/alpha.test.ts"],
      },
    ];

    expect(sortFileEntries(entries).map((entry) => entry.source)).toEqual([
      "src/alpha.ts",
      "src/zeta.ts",
    ]);
    expect(selectTopEntries(sortFileEntries(entries), 1)).toHaveLength(1);
  });

  it("renders summary and per-file text output", () => {
    const result: AnalysisResult = {
      project: {
        codeLoc: 10,
        testLoc: 20,
        ratio: 2,
        ratioFormatted: "1:2.00",
        unmatchedFiles: 1,
      },
      files: [
        {
          source: "src/alpha.ts",
          codeLoc: 10,
          testLoc: 0,
          ratio: null,
          ratioFormatted: null,
          matchedTests: [],
        },
      ],
    };

    const summary = formatSummaryLine(result);
    expect(summary).toContain("Code LOC: 10");
    expect(summary).toContain("Code to Test Ratio: 1:2.00");

    const text = formatTextReport(result, { includeFiles: true });
    expect(text).toContain("Files:");
    expect(text).toContain("src/alpha.ts");
    expect(text).toContain("No matching test");
  });
});
