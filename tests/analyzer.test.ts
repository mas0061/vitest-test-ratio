import { describe, expect, it } from "vitest";
import { analyzeProject } from "../src/analyzer.js";
import { countLoc } from "../src/loc.js";
import { createTempProject, removeTempProject, writeProjectFile } from "./helpers.js";

describe("countLoc", () => {
  it("counts source lines with sloc when a supported file extension is provided", () => {
    const content = `
const a = 1; // inline comment
// full line comment
/*
  block comment
*/
const b = 2;
const url = "http://example.com";
`;
    expect(countLoc(content, "sample.ts")).toBe(3);
  });

  it("falls back to lightweight counting for unknown extensions", () => {
    const content = `
const a = 1;
// only comment
const b = 2;
`;
    expect(countLoc(content, "sample.unknown")).toBe(2);
  });
});

describe("analyzeProject", () => {
  it("uses fallback patterns when vitest config cannot be resolved", async () => {
    const projectDir = await createTempProject();
    try {
      await writeProjectFile(
        projectDir,
        "src/foo.ts",
        "export const foo = 1;\nexport const bar = 2;\n",
      );
      await writeProjectFile(projectDir, "src/bar.ts", "export const bar = 1;\n");
      await writeProjectFile(projectDir, "src/types.d.ts", "export type X = string;\n");
      await writeProjectFile(
        projectDir,
        "src/foo.test.ts",
        "import { foo } from './foo';\nexpect(foo).toBe(1);\n",
      );
      await writeProjectFile(
        projectDir,
        "tests/bar.spec.ts",
        "import { bar } from '../src/bar';\nexpect(bar).toBe(1);\n",
      );

      const result = await analyzeProject({ cwd: projectDir });

      expect(result.project.codeLoc).toBe(3);
      expect(result.project.testLoc).toBe(4);
      expect(result.project.unmatchedFiles).toBe(0);
      expect(result.project.ratio).toBeCloseTo(1.333333, 6);

      const foo = result.files.find((entry) => entry.source === "src/foo.ts");
      const bar = result.files.find((entry) => entry.source === "src/bar.ts");

      expect(foo?.matchedTests).toEqual(["src/foo.test.ts"]);
      expect(foo?.testLoc).toBe(2);
      expect(bar?.matchedTests).toEqual(["tests/bar.spec.ts"]);
      expect(bar?.testLoc).toBe(2);
    } finally {
      await removeTempProject(projectDir);
    }
  });

  it("uses test.include and test.exclude from vitest config when readable", async () => {
    const projectDir = await createTempProject();
    try {
      await writeProjectFile(
        projectDir,
        "vitest.config.ts",
        `
export default {
  test: {
    include: ["specs/**/*.ts"],
    exclude: ["specs/ignored/**"]
  }
};
`,
      );
      await writeProjectFile(projectDir, "src/app.ts", "export const app = 1;\n");
      await writeProjectFile(projectDir, "src/other.ts", "export const other = 2;\n");
      await writeProjectFile(
        projectDir,
        "specs/app.ts",
        "expect(1).toBe(1);\nexpect(2).toBe(2);\n",
      );
      await writeProjectFile(projectDir, "specs/ignored/ignored.ts", "expect(3).toBe(3);\n");

      const result = await analyzeProject({ cwd: projectDir });

      expect(result.project.codeLoc).toBe(3);
      expect(result.project.testLoc).toBe(2);
      expect(result.project.unmatchedFiles).toBe(2);

      const appEntry = result.files.find((entry) => entry.source === "src/app.ts");
      const otherEntry = result.files.find((entry) => entry.source === "src/other.ts");
      const ignoredEntry = result.files.find(
        (entry) => entry.source === "specs/ignored/ignored.ts",
      );

      expect(appEntry?.matchedTests).toEqual(["specs/app.ts"]);
      expect(appEntry?.testLoc).toBe(2);
      expect(otherEntry?.matchedTests).toEqual([]);
      expect(ignoredEntry?.matchedTests).toEqual([]);
    } finally {
      await removeTempProject(projectDir);
    }
  });

  it("sums multiple matching tests and marks unmatched files", async () => {
    const projectDir = await createTempProject();
    try {
      await writeProjectFile(
        projectDir,
        "src/widget.ts",
        "export const widget = 1;\nexport const label = 'x';\n",
      );
      await writeProjectFile(projectDir, "src/nomatch.ts", "export const noMatch = true;\n");
      await writeProjectFile(projectDir, "tests/widget.test.ts", "expect(1).toBe(1);\n");
      await writeProjectFile(
        projectDir,
        "__tests__/widget.spec.ts",
        "expect(2).toBe(2);\nexpect(3).toBe(3);\n",
      );

      const result = await analyzeProject({ cwd: projectDir });
      const widget = result.files.find((entry) => entry.source === "src/widget.ts");
      const nomatch = result.files.find((entry) => entry.source === "src/nomatch.ts");

      expect(result.project.unmatchedFiles).toBe(1);
      expect(widget?.matchedTests).toEqual(["__tests__/widget.spec.ts", "tests/widget.test.ts"]);
      expect(widget?.testLoc).toBe(3);
      expect(widget?.ratio).toBeCloseTo(1.5, 6);

      expect(nomatch?.matchedTests).toEqual([]);
      expect(nomatch?.testLoc).toBe(0);
      expect(nomatch?.ratio).toBeNull();
      expect(nomatch?.ratioFormatted).toBeNull();
    } finally {
      await removeTempProject(projectDir);
    }
  });

  it("does not fallback to default include when test.include is explicitly empty", async () => {
    const projectDir = await createTempProject();
    try {
      await writeProjectFile(
        projectDir,
        "vitest.config.ts",
        `
export default {
  test: {
    include: [],
    exclude: []
  }
};
`,
      );
      await writeProjectFile(projectDir, "src/foo.ts", "export const foo = 1;\n");
      await writeProjectFile(projectDir, "tests/foo.test.ts", "expect(1).toBe(1);\n");

      const result = await analyzeProject({ cwd: projectDir });

      expect(result.project.codeLoc).toBe(1);
      expect(result.project.testLoc).toBe(0);
      expect(result.project.unmatchedFiles).toBe(1);
      expect(result.files.find((entry) => entry.source === "tests/foo.test.ts")).toBeUndefined();
    } finally {
      await removeTempProject(projectDir);
    }
  });
});
