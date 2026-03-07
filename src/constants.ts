export const SUPPORTED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

export const GLOBAL_IGNORE_PATTERNS = [
  "**/node_modules/**",
  "**/dist/**",
  "**/coverage/**",
  "**/.git/**",
];

export const DEFAULT_TEST_INCLUDE = [
  "**/*.{test,spec}.{ts,tsx,js,jsx}",
  "**/__tests__/**/*.{ts,tsx,js,jsx}",
  "**/tests/**/*.{ts,tsx,js,jsx}",
];
