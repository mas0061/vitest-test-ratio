import path from "node:path";

export function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

export function hasSupportedSourceExtension(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ext === ".ts" || ext === ".tsx" || ext === ".js" || ext === ".jsx";
}

export function isDeclarationFile(filePath: string): boolean {
  return filePath.endsWith(".d.ts");
}

export function normalizeTestBaseName(filePath: string): string {
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  return base.replace(/\.(test|spec)$/i, "");
}
