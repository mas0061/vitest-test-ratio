export interface ProjectSummary {
  codeLoc: number;
  testLoc: number;
  ratio: number | null;
  ratioFormatted: string;
  unmatchedFiles: number;
}

export interface FileRatioEntry {
  source: string;
  codeLoc: number;
  testLoc: number;
  ratio: number | null;
  ratioFormatted: string | null;
  matchedTests: string[];
}

export interface AnalysisResult {
  project: ProjectSummary;
  files: FileRatioEntry[];
}

export interface AnalyzeOptions {
  cwd: string;
}

export interface TestPatternResolution {
  include: string[];
  exclude: string[];
  configPath: string | null;
  usedConfigPatterns: boolean;
}
