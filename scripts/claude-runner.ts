// Shared helpers: prepare a throwaway copy of the sample project for a setup, run `claude -p` in it,
// and write run metadata. Authentication is whatever your installed Claude Code already uses;
// this repository never handles an API key.

import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ClaudeJsonResult, PromptCheck, RunManifest, SetupDefinition } from "./types.ts";

export const REPOSITORY_ROOT = path.resolve(import.meta.dirname, "..");
export const DEFAULT_SETUPS = ["default", "concise", "claude-md", "i-have-adhd"];

const SAMPLE_PROJECT_DIRECTORY = path.join(REPOSITORY_ROOT, "sample-project");
const SETUPS_DIRECTORY = path.join(REPOSITORY_ROOT, "setups");
const CLAUDE_TIMEOUT_MILLISECONDS = 5 * 60 * 1000;
const CLAUDE_ATTEMPTS = 3;
const RETRY_DELAY_MILLISECONDS = 30 * 1000;

// The tools Claude may use without asking. Enough to read, edit, and run the tests, nothing else.
const ALLOWED_TOOLS = "Read,Grep,Glob,Edit,Write,Bash(npm test*),Bash(node --test*)";

export function readJson<TValue>(filePath: string): TValue {
  // Trusted boundary: these JSON files ship with this repository or were written by these scripts.
  return JSON.parse(readFileSync(filePath, "utf-8")) as TValue;
}

export function readFlag(argumentList: string[], flagName: string): string | undefined {
  const flagIndex = argumentList.indexOf(flagName);

  return flagIndex === -1 ? undefined : argumentList[flagIndex + 1];
}

export function parseRepetitions(flagValue: string | undefined, defaultValue: number): number {
  const repetitions = flagValue === undefined ? defaultValue : Number(flagValue);

  if (!Number.isInteger(repetitions) || repetitions < 1) {
    throw new Error(`--repetitions must be a whole number of 1 or more, got "${flagValue}"`);
  }

  return repetitions;
}

export function readSetup(setupName: string): SetupDefinition {
  const setupFile = path.join(SETUPS_DIRECTORY, setupName, "setup.json");

  if (!existsSync(setupFile)) {
    throw new Error(`Unknown setup "${setupName}". Expected ${path.relative(REPOSITORY_ROOT, setupFile)}`);
  }

  return readJson<SetupDefinition>(setupFile);
}

// Reuses --output when given (to resume an interrupted run), otherwise creates a new timestamped folder.
export function resolveRunDirectory(kind: RunManifest["kind"], outputFlag: string | undefined): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const runDirectory = outputFlag === undefined ? path.join(REPOSITORY_ROOT, "results", `${kind}-${timestamp}`) : path.resolve(outputFlag);

  mkdirSync(runDirectory, { recursive: true });

  return runDirectory;
}

export function writeRunManifest(runDirectory: string, manifest: Omit<RunManifest, "claudeCodeVersion" | "nodeVersion" | "startedAt">): void {
  const manifestPath = path.join(runDirectory, "run.json");
  const fullManifest: RunManifest = {
    ...manifest,
    startedAt: new Date().toISOString(),
    claudeCodeVersion: execFileSync("claude", ["--version"], { encoding: "utf-8" }).trim(),
    nodeVersion: process.version,
  };

  if (!existsSync(manifestPath)) {
    writeFileSync(manifestPath, JSON.stringify(fullManifest, null, 2));
  }
}

export async function prepareProject(setupName: string, setup: SetupDefinition): Promise<string> {
  const projectDirectory = mkdtempSync(path.join(tmpdir(), `verbosity-${setupName}-`));

  cpSync(SAMPLE_PROJECT_DIRECTORY, projectDirectory, { recursive: true });
  cpSync(path.join(SETUPS_DIRECTORY, setupName, "overlay"), projectDirectory, { recursive: true });

  for (const download of setup.downloads) {
    const response = await fetch(download.url);
    const destination = path.join(projectDirectory, download.destination);

    if (!response.ok) {
      throw new Error(`Download failed (${response.status}): ${download.url}`);
    }

    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, await response.text());
  }

  return projectDirectory;
}

function runClaudeOnce(projectDirectory: string, prompt: string, resumeSessionId: string | null): ClaudeJsonResult {
  const resumeArguments = resumeSessionId === null ? [] : ["--resume", resumeSessionId];
  // --setting-sources project,local keeps your personal ~/.claude settings and CLAUDE.md out of the test.
  const claudeArguments = [
    "-p",
    prompt,
    ...resumeArguments,
    "--output-format",
    "json",
    "--setting-sources",
    "project,local",
    "--permission-mode",
    "acceptEdits",
    "--allowedTools",
    ALLOWED_TOOLS,
  ];
  const processResult = spawnSync("claude", claudeArguments, {
    cwd: projectDirectory,
    encoding: "utf-8",
    timeout: CLAUDE_TIMEOUT_MILLISECONDS,
  });

  if (processResult.status !== 0) {
    throw new Error(`claude exited with ${processResult.status}: ${processResult.stderr || processResult.stdout}`);
  }

  // Trusted boundary: the shape is Claude Code's documented JSON output format.
  return JSON.parse(processResult.stdout) as ClaudeJsonResult;
}

// Retries with a pause, so a rate limit or a timeout doesn't lose the whole run.
export function runClaude(projectDirectory: string, prompt: string, resumeSessionId: string | null): ClaudeJsonResult {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= CLAUDE_ATTEMPTS; attempt++) {
    try {
      return runClaudeOnce(projectDirectory, prompt, resumeSessionId);
    } catch (error: unknown) {
      lastError = error;

      if (attempt < CLAUDE_ATTEMPTS) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, RETRY_DELAY_MILLISECONDS);
      }
    }
  }

  throw new Error(`claude failed after ${CLAUDE_ATTEMPTS} attempts: ${String(lastError)}`);
}

// Starts a session in the project. Setups with an activation prompt (like /i-have-adhd) run it first.
export function startSession(projectDirectory: string, setup: SetupDefinition): { sessionId: string | null; costUsd: number } {
  if (setup.activationPrompt === null) {
    return { sessionId: null, costUsd: 0 };
  }

  const activation = runClaude(projectDirectory, setup.activationPrompt, null);

  return { sessionId: activation.session_id, costUsd: activation.total_cost_usd };
}

export function runCheck(projectDirectory: string, check: PromptCheck | null): boolean | null {
  if (check === null) {
    return null;
  }
  if (check.type === "tests-pass") {
    return spawnSync("npm", ["test"], { cwd: projectDirectory, encoding: "utf-8" }).status === 0;
  }

  const filePath = path.join(projectDirectory, check.file);

  return existsSync(filePath) && readFileSync(filePath, "utf-8").includes(check.text);
}

export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
