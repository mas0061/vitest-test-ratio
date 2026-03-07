# vitest-test-ratio

`vitest-test-ratio` is a single-purpose CLI that measures Code LOC to Test LOC ratio for Vitest projects, with a Rails stats style summary line.

This repository uses `pnpm` for development.

## Features

- Reads `vitest.config.*` when possible and uses `test.include` / `test.exclude`
- Falls back to built-in test patterns when config cannot be resolved
- Collects `ts` / `tsx` / `js` / `jsx` source and test files
- Excludes `.d.ts`, `node_modules`, `dist`, `coverage`, and detected test files from code files
- Computes project-level Code LOC, Test LOC, ratio, and unmatched file count
- Maps source files to tests by basename (supports `__tests__` and `tests/`)
- Supports text output and JSON output

## Install

```bash
npm install -g vitest-test-ratio
```

Or run without installing globally:

```bash
npx vitest-test-ratio
```

With pnpm:

```bash
pnpm dlx vitest-test-ratio
```

## Usage

```bash
vitest-test-ratio [options]
```

### Options

- `--files` Show per-file ratio entries
- `--top <n>` Show top N files by code LOC (implies `--files`)
- `--json` Output JSON
- `--cwd <path>` Analyze a specific directory (default: current directory)
- `-h, --help` Show help

## Vitest Integration Examples

`vitest-test-ratio` is a standalone CLI, not a Vitest plugin.  
You can still integrate it into a Vitest workflow with npm scripts or CI.

### Run after Vitest locally

```json
{
  "scripts": {
    "test:with-ratio": "vitest run && vitest-test-ratio --files"
  }
}
```

### Run after tests in GitHub Actions

```yaml
- name: Test
  run: pnpm run test

- name: Test ratio
  run: pnpm vitest-test-ratio --json
```

## Text Output

Summary line format:

```txt
Code LOC: 4231     Test LOC: 3120     Code to Test Ratio: 1:0.74     Unmatched files: 12
```

Per-file unmatched entries show:

```txt
No matching test
```

## JSON Output

JSON includes:

- `project.codeLoc`
- `project.testLoc`
- `project.ratio`
- `project.ratioFormatted`
- `project.unmatchedFiles`
- `files[]` entries:
  - `source`
  - `codeLoc`
  - `testLoc`
  - `ratio`
  - `ratioFormatted`
  - `matchedTests`

For unmatched files:

- `testLoc: 0`
- `ratio: null`
- `matchedTests: []`

`ratio` and `ratioFormatted` are capped at a maximum of `1:2.00`.

## How File Matching Works

- Source and test files are matched by basename.
- Example: `src/user.ts` matches `tests/user.test.ts`, `__tests__/user.spec.ts`, etc.
- If multiple tests match one source file, their LOC values are summed.

## LOC Counting Policy

This tool uses [`sloc`](https://www.npmjs.com/package/sloc) by default for supported file types (`.ts`, `.tsx`, `.js`, `.jsx`) and reads `source` lines from its result.

If `sloc` cannot be applied for a file (for example, unsupported extension or runtime parse failure), it falls back to a lightweight local counter:

- remove comment-only content with a simple parser
- count non-empty lines

This fallback keeps the CLI resilient without requiring additional user setup.

## Vitest Config Support

`vitest-test-ratio` looks for:

- `vitest.config.ts`
- `vitest.config.mts`
- `vitest.config.cts`
- `vitest.config.js`
- `vitest.config.mjs`
- `vitest.config.cjs`

When readable, it extracts `test.include` and `test.exclude` string arrays. If extraction fails, built-in test patterns are used.

## Non-goals

- No coverage integration
- No import graph analysis
- No Vite config parsing
- No workspace/deep monorepo features
- No extra metrics beyond code/test ratio output

## Development

```bash
pnpm install
pnpm run lint
pnpm run test
pnpm run test:coverage
pnpm run build
```

## Try It Locally

This repository includes a runnable sample project under `examples/basic`.

```bash
pnpm run demo
```

## Quality Gates

- Unit tests: Vitest (`tests/*.test.ts`)
- Coverage: `pnpm run test:coverage` (output: `coverage/`, HTML report: `coverage/index.html`)
- Lint / format: Biome (`pnpm run lint`, `pnpm run format`)
- CI: GitHub Actions (`.github/workflows/ci.yml`) runs lint, build, and test

## Publish with GitHub Actions

This repository includes a publish workflow:

- [publish.yml](/Users/mas/ghq/github.com/mas0061/vitest-test-ratio/.github/workflows/publish.yml)
- Trigger: push tag `v*` or manual `workflow_dispatch`
- Auth: npm Trusted Publishing (OIDC, no `NPM_TOKEN` secret)

Required setup:

1. On npm, open package settings and add a Trusted Publisher for this GitHub repository/workflow
2. Keep the workflow file path as `.github/workflows/publish.yml`
3. Bump `package.json` version
4. Push a matching tag (example: `v0.1.0` for version `0.1.0`)

Example release commands:

```bash
git tag v0.1.0
git push origin v0.1.0
```

## License

MIT
