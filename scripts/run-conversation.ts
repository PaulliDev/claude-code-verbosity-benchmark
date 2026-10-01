// Runs the same 10-turn conversation in each setup to see whether brevity lasts or wears off.
// Usage: node scripts/run-conversation.ts [--setups a,b] [--repetitions 2] [--output results/<folder>]
// Pass --output with an existing folder to resume: finished conversations are skipped.

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
  runClaude,
  startSession,
  writeRunManifest,
} from "./claude-runner.ts";
import type { ConversationTurnRecord } from "./types.ts";

const DEFAULT_REPETITIONS = 2;

async function runConversation(setupName: string, turnPrompts: string[], repetition: number): Promise<ConversationTurnRecord[]> {
  const setup = readSetup(setupName);
  const projectDirectory = await prepareProject(setupName, setup);
  const turnRecords: ConversationTurnRecord[] = [];

  try {
    let sessionId = startSession(projectDirectory, setup).sessionId;

    for (const [turnIndex, prompt] of turnPrompts.entries()) {
      const result = runClaude(projectDirectory, prompt, sessionId);

      sessionId = result.session_id;
      turnRecords.push({
        setup: setupName,
        repetition: repetition,
        turn: turnIndex + 1,
        prompt: prompt,
        reply: result.result,
        costUsd: result.total_cost_usd,
      });
      process.stdout.write(`${setupName} #${repetition} turn ${turnIndex + 1}: ${result.result.split(/\s+/).length} words\n`);
    }

    return turnRecords;
  } finally {
    rmSync(projectDirectory, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const argumentList = process.argv.slice(2);
  const setupsFlag = readFlag(argumentList, "--setups");
  const setupNames = setupsFlag ? setupsFlag.split(",") : DEFAULT_SETUPS;
  const repetitions = parseRepetitions(readFlag(argumentList, "--repetitions"), DEFAULT_REPETITIONS);
  const turnPrompts = readJson<string[]>(path.join(REPOSITORY_ROOT, "prompts", "conversation.json"));
  const runDirectory = resolveRunDirectory("conversation", readFlag(argumentList, "--output"));

  writeRunManifest(runDirectory, { kind: "conversation", setups: setupNames, repetitions: repetitions, promptIds: [] });

  for (const setupName of setupNames) {
    for (let repetition = 1; repetition <= repetitions; repetition++) {
      const recordPath = path.join(runDirectory, `${setupName}__${repetition}.json`);

      if (existsSync(recordPath)) {
        continue;
      }

      try {
        const turnRecords = await runConversation(setupName, turnPrompts, repetition);

        writeFileSync(recordPath, JSON.stringify(turnRecords, null, 2));
      } catch (error: unknown) {
        writeFileSync(
          path.join(runDirectory, `${setupName}__${repetition}.failed.json`),
          JSON.stringify({ setup: setupName, repetition: repetition, error: describeError(error) }, null, 2)
        );
        process.stdout.write(`${setupName} #${repetition}: FAILED\n`);
      }
    }
  }

  process.stdout.write(`\nSaved to ${path.relative(REPOSITORY_ROOT, runDirectory)}\n`);
}

await main();
