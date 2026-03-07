import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveTestPatterns } from "../src/config.js";
import { DEFAULT_TEST_INCLUDE } from "../src/constants.js";
import { createTempProject, removeTempProject, writeProjectFile } from "./helpers.js";

describe("resolveTestPatterns", () => {
  it("falls back to default patterns when config does not exist", async () => {
    const projectDir = await createTempProject();
    try {
      const result = await resolveTestPatterns(projectDir);

      expect(result.configPath).toBeNull();
      expect(result.usedConfigPatterns).toBe(false);
      expect(result.include).toEqual(DEFAULT_TEST_INCLUDE);
      expect(result.exclude).toEqual([]);
    } finally {
      await removeTempProject(projectDir);
    }
  });

  it("reads include and exclude from test block", async () => {
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
}
`,
      );

      const result = await resolveTestPatterns(projectDir);

      expect(result.configPath).toBe(path.join(projectDir, "vitest.config.ts"));
      expect(result.usedConfigPatterns).toBe(true);
      expect(result.include).toEqual(["specs/**/*.ts"]);
      expect(result.exclude).toEqual(["specs/ignored/**"]);
    } finally {
      await removeTempProject(projectDir);
    }
  });

  it("treats explicitly empty include/exclude arrays as configured values", async () => {
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
}
`,
      );

      const result = await resolveTestPatterns(projectDir);

      expect(result.usedConfigPatterns).toBe(true);
      expect(result.include).toEqual([]);
      expect(result.exclude).toEqual([]);
    } finally {
      await removeTempProject(projectDir);
    }
  });

  it("falls back when config exists but include/exclude cannot be extracted", async () => {
    const projectDir = await createTempProject();
    try {
      await writeProjectFile(
        projectDir,
        "vitest.config.ts",
        `
export default {
  test: {
    globals: true
  }
}
`,
      );

      const result = await resolveTestPatterns(projectDir);

      expect(result.configPath).toBe(path.join(projectDir, "vitest.config.ts"));
      expect(result.usedConfigPatterns).toBe(false);
      expect(result.include).toEqual(DEFAULT_TEST_INCLUDE);
      expect(result.exclude).toEqual([]);
    } finally {
      await removeTempProject(projectDir);
    }
  });
});
