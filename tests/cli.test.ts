import { describe, expect, it } from "vitest";
import { runCli } from "../src/cli.js";
import { createTempProject, removeTempProject, writeProjectFile } from "./helpers.js";

function createIoCapture() {
  let stdout = "";
  let stderr = "";

  return {
    io: {
      stdout: {
        write: (text: string) => {
          stdout += text;
        },
      },
      stderr: {
        write: (text: string) => {
          stderr += text;
        },
      },
    },
    read: () => ({ stdout, stderr }),
  };
}

describe("runCli", () => {
  it("prints rails-stats-like summary", async () => {
    const projectDir = await createTempProject();
    try {
      await writeProjectFile(projectDir, "src/foo.ts", "export const foo = 1;\n");
      await writeProjectFile(projectDir, "tests/foo.test.ts", "expect(1).toBe(1);\n");

      const capture = createIoCapture();
      const code = await runCli(["--cwd", projectDir], capture.io);
      const output = capture.read();

      expect(code).toBe(0);
      expect(output.stderr).toBe("");
      expect(output.stdout).toContain("Code LOC: 1");
      expect(output.stdout).toContain("Test LOC: 1");
      expect(output.stdout).toContain("Code to Test Ratio: 1:1.00");
      expect(output.stdout).toContain("Unmatched files: 0");
    } finally {
      await removeTempProject(projectDir);
    }
  });

  it("emits json output with required project and file fields", async () => {
    const projectDir = await createTempProject();
    try {
      await writeProjectFile(projectDir, "src/foo.ts", "export const foo = 1;\n");
      await writeProjectFile(projectDir, "src/bar.ts", "export const bar = 2;\n");
      await writeProjectFile(projectDir, "tests/foo.test.ts", "expect(1).toBe(1);\n");

      const capture = createIoCapture();
      const code = await runCli(["--cwd", projectDir, "--json"], capture.io);
      const output = capture.read();

      expect(code).toBe(0);
      const parsed = JSON.parse(output.stdout);

      expect(parsed.project.codeLoc).toBe(2);
      expect(parsed.project.testLoc).toBe(1);
      expect(parsed.project.ratio).toBeCloseTo(0.5, 6);
      expect(parsed.project.ratioFormatted).toBe("1:0.50");
      expect(parsed.project.unmatchedFiles).toBe(1);

      const bar = parsed.files.find((entry: { source: string }) => entry.source === "src/bar.ts");
      expect(bar.testLoc).toBe(0);
      expect(bar.ratio).toBeNull();
      expect(bar.matchedTests).toEqual([]);
    } finally {
      await removeTempProject(projectDir);
    }
  });

  it("supports --top and unmatched text label", async () => {
    const projectDir = await createTempProject();
    try {
      await writeProjectFile(
        projectDir,
        "src/alpha.ts",
        "export const a = 1;\nexport const b = 2;\n",
      );
      await writeProjectFile(projectDir, "src/beta.ts", "export const c = 3;\n");
      await writeProjectFile(projectDir, "tests/alpha.test.ts", "expect(1).toBe(1);\n");

      const capture = createIoCapture();
      const code = await runCli(["--cwd", projectDir, "--top", "1"], capture.io);
      const output = capture.read();

      expect(code).toBe(0);
      expect(output.stdout).toContain("Files:");
      expect(output.stdout).toContain("src/alpha.ts");
      expect(output.stdout).toContain("tests/alpha.test.ts");
      expect(output.stdout).not.toContain("src/beta.ts");
      expect(output.stdout).not.toContain("No matching test");
    } finally {
      await removeTempProject(projectDir);
    }
  });

  it("sorts file output alphabetically by source path", async () => {
    const projectDir = await createTempProject();
    try {
      await writeProjectFile(
        projectDir,
        "src/zeta.ts",
        "export const z = 1;\nexport const zz = 2;\n",
      );
      await writeProjectFile(projectDir, "src/alpha.ts", "export const a = 1;\n");
      await writeProjectFile(projectDir, "tests/alpha.test.ts", "expect(1).toBe(1);\n");

      const capture = createIoCapture();
      const code = await runCli(["--cwd", projectDir, "--files"], capture.io);
      const output = capture.read();

      expect(code).toBe(0);
      const alphaIndex = output.stdout.indexOf("src/alpha.ts");
      const zetaIndex = output.stdout.indexOf("src/zeta.ts");

      expect(alphaIndex).toBeGreaterThanOrEqual(0);
      expect(zetaIndex).toBeGreaterThanOrEqual(0);
      expect(alphaIndex).toBeLessThan(zetaIndex);
    } finally {
      await removeTempProject(projectDir);
    }
  });
});
