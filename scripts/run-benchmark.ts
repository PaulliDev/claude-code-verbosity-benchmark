// Runs every prompt against every setup with `claude -p` and saves one JSON record per run.
// Usage: node scripts/run-benchmark.ts [--setups a,b] [--prompts id1,id2] [--repetitions 3] [--output results/<folder>]
// Pass --output with an existing folder to resume: runs that already have a record are skipped.

import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  DEFAULT_SETUPS,
  REPOSITORY_ROOT,
  describeError,
  parseRepetitions,
  prepareProject,
  readFlag,
  readJson,
  readSetup,
  resolveRunDirectory,
  runCheck,
  runClaude,
  startSession,
  writeRunManifest,
} from "./claude-runner.ts";
import type { PromptDefinition, RunFailure, RunRecord } from "./types.ts";

const DEFAULT_REPETITIONS = 3;

async function runOnce(setupName: string, prompt: PromptDefinition, repetition: number): Promise<RunRecord> {
  const setup = readSetup(setupName);
  const projectDirectory = await prepareProject(setupName, setup);

  try {
    const session = startSession(projectDirectory, setup);
    const result = runClaude(projectDirectory, prompt.text, session.sessionId);

    return {
      setup: setupName,
      promptId: prompt.id,
      promptKind: prompt.kind,
      repetition: repetition,
      model: Object.keys(result.modelUsage).join(","),
      reply: result.result,
      outputTokens: result.usage.output_tokens,
      costUsd: result.total_cost_usd,
      activationCostUsd: session.costUsd,
      durationMilliseconds: result.duration_ms,
      turns: result.num_turns,
      isError: result.is_error,
      checkPassed: runCheck(projectDirectory, prompt.check),
    };
  } finally {
    rmSync(projectDirectory, { recursive: true, force: true });
  }
}

async function runAndSave(runDirectory: string, setupName: string, prompt: PromptDefinition, repetition: number): Promise<void> {
  const recordName = `${setupName}__${prompt.id}__${repetition}`;
  const recordPath = path.join(runDirectory, `${recordName}.json`);
  const failurePath = path.join(runDirectory, `${recordName}.failed.json`);

  if (existsSync(recordPath)) {
    return;
  }

  try {
    const record = await runOnce(setupName, prompt, repetition);

    writeFileSync(recordPath, JSON.stringify(record, null, 2));
    rmSync(failurePath, { force: true });
    process.stdout.write(`${recordName}: ${record.reply.split(/\s+/).length} words\n`);
  } catch (error: unknown) {
    const failure: RunFailure = { setup: setupName, promptId: prompt.id, repetition: repetition, error: describeError(error) };

    writeFileSync(failurePath, JSON.stringify(failure, null, 2));
    process.stdout.write(`${recordName}: FAILED, see ${path.basename(failurePath)}\n`);
  }
}

async function main(): Promise<void> {
  const argumentList = process.argv.slice(2);
  const setupsFlag = readFlag(argumentList, "--setups");
  const promptsFlag = readFlag(argumentList, "--prompts");
  const allPrompts = readJson<PromptDefinition[]>(path.join(REPOSITORY_ROOT, "prompts", "prompts.json"));
  const setupNames = setupsFlag ? setupsFlag.split(",") : DEFAULT_SETUPS;
  const promptIds = promptsFlag ? promptsFlag.split(",") : allPrompts.map((prompt: PromptDefinition) => prompt.id);
  const prompts = allPrompts.filter((prompt: PromptDefinition) => promptIds.includes(prompt.id));
  const repetitions = parseRepetitions(readFlag(argumentList, "--repetitions"), DEFAULT_REPETITIONS);
  const runDirectory = resolveRunDirectory("benchmark", readFlag(argumentList, "--output"));

  writeRunManifest(runDirectory, { kind: "benchmark", setups: setupNames, repetitions: repetitions, promptIds: promptIds });

  for (const setupName of setupNames) {
    for (const prompt of prompts) {
      for (let repetition = 1; repetition <= repetitions; repetition++) {
        await runAndSave(runDirectory, setupName, prompt, repetition);
      }
    }
  }

  process.stdout.write(`\nSaved to ${path.relative(REPOSITORY_ROOT, runDirectory)}\n`);
}

await main();
