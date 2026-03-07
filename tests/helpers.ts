import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export async function createTempProject(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "vitest-test-ratio-"));
}

export async function removeTempProject(projectDir: string): Promise<void> {
  await rm(projectDir, { recursive: true, force: true });
}

export async function writeProjectFile(
  projectDir: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const fullPath = path.join(projectDir, relativePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, "utf8");
}
