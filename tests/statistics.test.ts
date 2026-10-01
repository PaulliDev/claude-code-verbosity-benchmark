import { test } from "node:test";
import assert from "node:assert/strict";
import { average, bootstrapMedianInterval, createSeededRandom, median, medianRatio, signTestPValue } from "../scripts/statistics.ts";

test("median of an odd-length list is the middle value", () => {
  assert.equal(median([9, 1, 5]), 5);
});

test("median of an even-length list averages the two middle values", () => {
  assert.equal(median([4, 1, 3, 2]), 2.5);
});

test("median of an empty list is 0", () => {
  assert.equal(median([]), 0);
});

test("average of an empty list is 0", () => {
  assert.equal(average([]), 0);
});

test("sign test: 8 wins and 0 losses gives p = 2/256", () => {
  assert.equal(signTestPValue(8, 0), 2 / 256);
});

test("sign test: an even split gives p = 1", () => {
  assert.equal(signTestPValue(4, 4), 1);
});

test("sign test: no comparisons gives p = 1", () => {
  assert.equal(signTestPValue(0, 0), 1);
});

test("seeded random is repeatable and stays in [0, 1)", () => {
  const firstSequence = Array.from({ length: 5 }, createSeededRandom(42));
  const secondSequence = Array.from({ length: 5 }, createSeededRandom(42));

  assert.deepEqual(firstSequence, secondSequence);
  assert.equal(firstSequence.every((value: number) => value >= 0 && value < 1), true);
});

test("bootstrap interval contains the median and is ordered", () => {
  const interval = bootstrapMedianInterval([[10, 12], [20, 22], [30, 31], [40, 44]]);

  assert.equal(interval.lowerBound <= interval.median, true);
  assert.equal(interval.median <= interval.upperBound, true);
});

test("bootstrap interval of identical values has zero width", () => {
  const interval = bootstrapMedianInterval([[7, 7], [7, 7]]);

  assert.deepEqual(interval, { median: 7, lowerBound: 7, upperBound: 7 });
});

test("median ratio compares prompt by prompt", () => {
  assert.equal(medianRatio([10, 40, 90], [20, 80, 100]), 0.5);
});

test("median ratio skips prompts where the baseline is zero", () => {
  assert.equal(medianRatio([5, 30], [0, 60]), 0.5);
});
