import { test } from "node:test";
import assert from "node:assert/strict";
import { countWords, findFillerPhrases, measureReply } from "../scripts/reply-metrics.ts";

test("counts words separated by any whitespace", () => {
  assert.equal(countWords("  one two\nthree\tfour "), 4);
});

test("empty text has zero words", () => {
  assert.equal(countWords("   "), 0);
});

test("code blocks count as lines, not words", () => {
  const reply = "Fixed it.\n\n```ts\nconst total = 1;\n\nreturn total;\n```\n\nAll tests pass.";

  assert.deepEqual(measureReply(reply), { proseWords: 5, codeLines: 2 });
});

test("inline code stays part of the prose", () => {
  assert.deepEqual(measureReply("Run `npm test` now."), { proseWords: 4, codeLines: 0 });
});

test("finds closing offers and openers", () => {
  const phrases = findFillerPhrases("Sure! Here it is. Let me know if you want more.");

  assert.equal(phrases.length, 2);
});

test("a plain answer has no filler", () => {
  assert.deepEqual(findFillerPhrases("The tax rate is defined in src/money.ts."), []);
});

test("filler words inside other words don't match", () => {
  assert.deepEqual(findFillerPhrases("The basic flow is unchanged."), []);
});
