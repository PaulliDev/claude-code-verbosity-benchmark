// An automatic check run on the project after a task prompt.
export type PromptCheck =
  | { type: "tests-pass" }
  | { type: "file-contains"; file: string; text: string };

// A test prompt from prompts/prompts.json. expectedAnswer is what the judge grades against.
export interface PromptDefinition {
  id: string;
  kind: string;
  text: string;
  expectedAnswer: string;
  check: PromptCheck | null;
}

// A file a setup fetches into the test project, such as a third-party skill.
export interface SetupDownload {
  url: string;
  destination: string;
}

// A setup from setups/<name>/setup.json. Files in setups/<name>/overlay are copied into the project.
export interface SetupDefinition {
  description: string;
  activationPrompt: string | null;
  downloads: SetupDownload[];
}

// The subset of `claude -p --output-format json` fields this benchmark reads.
// Field names are snake_case because that's Claude Code's output format.
export interface ClaudeJsonResult {
  result: string;
  session_id: string;
  is_error: boolean;
  num_turns: number;
  duration_ms: number;
  total_cost_usd: number;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
  };
  modelUsage: Record<string, unknown>;
}

// Written once per run as run.json, so results can be reproduced and compared later.
export interface RunManifest {
  kind: "benchmark" | "conversation";
  startedAt: string;
  claudeCodeVersion: string;
  nodeVersion: string;
  setups: string[];
  repetitions: number;
  promptIds: string[];
}

// One saved benchmark run.
export interface RunRecord {
  setup: string;
  promptId: string;
  promptKind: string;
  repetition: number;
  model: string;
  reply: string;
  outputTokens: number;
  costUsd: number;
  activationCostUsd: number;
  durationMilliseconds: number;
  turns: number;
  isError: boolean;
  checkPassed: boolean | null;
}

// Saved instead of a RunRecord when a run still fails after its retries.
export interface RunFailure {
  setup: string;
  promptId: string;
  repetition: number;
  error: string;
}

// One turn of the multi-turn conversation test.
export interface ConversationTurnRecord {
  setup: string;
  repetition: number;
  turn: number;
  prompt: string;
  reply: string;
  costUsd: number;
}

// The judge's verdict on one reply.
export interface JudgeVerdict {
  correct: boolean;
  wordsBeforeAnswer: number;
  reason: string;
}

// How a reply splits into prose and code.
export interface ReplyLength {
  proseWords: number;
  codeLines: number;
}

// A run record with its scores.
export interface ScoredRecord extends RunRecord {
  proseWords: number;
  codeLines: number;
  fillerPhrases: string[];
  verdict: JudgeVerdict;
}

// A median with its 95% confidence interval.
export interface MedianWithInterval {
  median: number;
  lowerBound: number;
  upperBound: number;
}

// How often a setup's median reply was shorter than the default's on the same prompt.
export interface PairedComparison {
  setup: string;
  shorterOnPrompts: number;
  longerOnPrompts: number;
  tiedOnPrompts: number;
  signTestPValue: number;
}
