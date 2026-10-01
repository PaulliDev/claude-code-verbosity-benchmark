import { test } from "node:test";
import assert from "node:assert/strict";
import { parseVerdict } from "../scripts/judge.ts";

test("parses a valid verdict wrapped in extra text", () => {
  const verdict = parseVerdict('Here you go: {"correct": true, "wordsBeforeAnswer": 0, "reason": "Direct answer."}');

  assert.deepEqual(verdict, { correct: true, wordsBeforeAnswer: 0, reason: "Direct answer." });
});

test("rejects output without JSON", () => {
  assert.throws(() => parseVerdict("I think it's correct."), /no JSON object/);
});

test("rejects a verdict with the wrong field type", () => {
  assert.throws(() => parseVerdict('{"correct": "yes", "wordsBeforeAnswer": 0, "reason": "x"}'), /invalid verdict/);
});

test("rejects a negative or fractional word count", () => {
  assert.throws(() => parseVerdict('{"correct": true, "wordsBeforeAnswer": -1, "reason": "x"}'), /invalid verdict/);
  assert.throws(() => parseVerdict('{"correct": true, "wordsBeforeAnswer": 2.5, "reason": "x"}'), /invalid verdict/);
});

test("rejects a verdict with a missing field", () => {
  assert.throws(() => parseVerdict('{"correct": true, "wordsBeforeAnswer": 0}'), /invalid verdict/);
});
