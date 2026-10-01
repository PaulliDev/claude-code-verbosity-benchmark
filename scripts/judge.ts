// A blind judge: a separate Claude model grades one reply against the expected answer
// without knowing which setup wrote it.

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ClaudeJsonResult, JudgeVerdict, PromptDefinition } from "./types.ts";

// A cheaper model is enough for grading, and it's a different model from the one being tested.
const JUDGE_MODEL = "sonnet";
const JUDGE_TIMEOUT_MILLISECONDS = 2 * 60 * 1000;
const JUDGE_ATTEMPTS = 3;

export function buildJudgePrompt(prompt: PromptDefinition, reply: string): string {
  return [
    "You are grading one reply from a coding assistant. You don't know which configuration produced it.",
    "",
    `Question the user asked: ${prompt.text}`,
    `Expected answer (reference): ${prompt.expectedAnswer}`,
    "",
    "Reply to grade:",
    "<reply>",
    reply,
    "</reply>",
    "",
    "Return only a JSON object, no other text:",
    '{"correct": boolean, "wordsBeforeAnswer": number, "reason": string}',
    "- correct: true if the reply answers the question and matches the reference, with no false claims.",
    "  You only see the final reply, not the actions behind it. The assistant can read files and run the tests,",
    "  so don't mark a reply wrong for saying it ran a command or checked something.",
    "- wordsBeforeAnswer: the number of words before the first sentence that directly answers the question",
    "  (for a task, before the sentence that states the result). 0 if the first sentence already answers.",
    "- reason: one short sentence.",
  ].join("\n");
}

// The judge is a model, so its output is untrusted: extract the JSON and check every field.
export function parseVerdict(judgeText: string): JudgeVerdict {
  const jsonMatch = judgeText.match(/\{[\s\S]*\}/);

  if (jsonMatch === null) {
    throw new Error(`Judge returned no JSON object: ${judgeText}`);
  }

  const parsed: unknown = JSON.parse(jsonMatch[0]);

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("correct" in parsed) ||
    !("wordsBeforeAnswer" in parsed) ||
    !("reason" in parsed) ||
    typeof parsed.correct !== "boolean" ||
    typeof parsed.wordsBeforeAnswer !== "number" ||
    !Number.isInteger(parsed.wordsBeforeAnswer) ||
    parsed.wordsBeforeAnswer < 0 ||
    typeof parsed.reason !== "string"
  ) {
    throw new Error(`Judge returned an invalid verdict: ${jsonMatch[0]}`);
  }

  return { correct: parsed.correct, wordsBeforeAnswer: parsed.wordsBeforeAnswer, reason: parsed.reason };
}

function requestVerdict(judgePrompt: string): JudgeVerdict {
  const judgeWorkingDirectory = mkdtempSync(path.join(tmpdir(), "verbosity-judge-"));

  try {
    const processResult = spawnSync(
      "claude",
      ["-p", judgePrompt, "--model", JUDGE_MODEL, "--output-format", "json", "--setting-sources", "project,local"],
      { cwd: judgeWorkingDirectory, encoding: "utf-8", timeout: JUDGE_TIMEOUT_MILLISECONDS }
    );

    if (processResult.status !== 0) {
      throw new Error(`Judge exited with ${processResult.status}: ${processResult.stderr}`);
    }

    // Trusted boundary: this is Claude Code's own JSON envelope. The verdict inside it is checked by parseVerdict.
    const judgeResult = JSON.parse(processResult.stdout) as ClaudeJsonResult;

    return parseVerdict(judgeResult.result);
  } finally {
    rmSync(judgeWorkingDirectory, { recursive: true, force: true });
  }
}

export function judgeReply(prompt: PromptDefinition, reply: string): JudgeVerdict {
  const judgePrompt = buildJudgePrompt(prompt, reply);
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= JUDGE_ATTEMPTS; attempt++) {
    try {
      return requestVerdict(judgePrompt);
    } catch (error: unknown) {
      lastError = error;
    }
  }

  throw new Error(`Judge failed after ${JUDGE_ATTEMPTS} attempts: ${String(lastError)}`);
}
