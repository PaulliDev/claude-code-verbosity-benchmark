// Small statistics helpers. Pure functions, covered by tests/statistics.test.ts.

import type { MedianWithInterval } from "./types.ts";

const BOOTSTRAP_ITERATIONS = 5000;
const BOOTSTRAP_SEED = 20260930;

export function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum: number, value: number) => sum + value, 0) / values.length;
}

export function median(values: number[]): number {
  const sortedValues = [...values].sort((first: number, second: number) => first - second);
  const middleIndex = Math.floor(sortedValues.length / 2);
  const upperMiddleValue = sortedValues[middleIndex];
  const lowerMiddleValue = sortedValues[middleIndex - 1];

  if (upperMiddleValue === undefined) {
    return 0;
  }
  if (sortedValues.length % 2 === 0 && lowerMiddleValue !== undefined) {
    return (lowerMiddleValue + upperMiddleValue) / 2;
  }

  return upperMiddleValue;
}

export function percentile(sortedValues: number[], fraction: number): number {
  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.round(fraction * (sortedValues.length - 1))));

  return sortedValues[index] ?? 0;
}

// Mulberry32: a tiny seeded random number generator, so bootstrap intervals are the same on every run.
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return (): number => {
    state = (state + 0x6d2b79f5) >>> 0;

    let mixed = state;

    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);

    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

// Cluster bootstrap: resamples whole prompts, not single replies, because replies to the same
// prompt are not independent of each other.
export function bootstrapMedianInterval(valuesByPrompt: number[][]): MedianWithInterval {
  const random = createSeededRandom(BOOTSTRAP_SEED);
  const bootstrapMedians: number[] = [];

  for (let i = 0; i < BOOTSTRAP_ITERATIONS; i++) {
    const resampledValues: number[] = [];

    for (let promptDraw = 0; promptDraw < valuesByPrompt.length; promptDraw++) {
      const drawnPrompt = valuesByPrompt[Math.floor(random() * valuesByPrompt.length)] ?? [];

      resampledValues.push(...drawnPrompt);
    }

    bootstrapMedians.push(median(resampledValues));
  }

  bootstrapMedians.sort((first: number, second: number) => first - second);

  return {
    median: median(valuesByPrompt.flat()),
    lowerBound: percentile(bootstrapMedians, 0.025),
    upperBound: percentile(bootstrapMedians, 0.975),
  };
}

function binomialCoefficient(total: number, chosen: number): number {
  let result = 1;

  for (let i = 1; i <= chosen; i++) {
    result = (result * (total - chosen + i)) / i;
  }

  return result;
}

// Exact two-sided sign test. Ties are left out, as the test requires.
export function signTestPValue(wins: number, losses: number): number {
  const trials = wins + losses;
  const smallerCount = Math.min(wins, losses);
  let tailProbability = 0;

  if (trials === 0) {
    return 1;
  }

  for (let successes = 0; successes <= smallerCount; successes++) {
    tailProbability += binomialCoefficient(trials, successes) / 2 ** trials;
  }

  return Math.min(1, 2 * tailProbability);
}

// Median of per-prompt ratios (setup length / baseline length). 0.5 means "half as long as the
// baseline on a typical prompt". Prompts where the baseline median is 0 are skipped.
export function medianRatio(setupMedians: number[], baselineMedians: number[]): number {
  const ratios = setupMedians
    .map((setupMedian: number, index: number) => {
      const baselineMedian = baselineMedians[index];

      return baselineMedian === undefined || baselineMedian === 0 ? null : setupMedian / baselineMedian;
    })
    .filter((ratio: number | null): ratio is number => ratio !== null);

  return median(ratios);
}
