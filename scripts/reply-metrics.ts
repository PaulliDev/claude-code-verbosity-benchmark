// Measures a single reply: prose words, code lines, and filler phrases. Pure functions,
// covered by tests/reply-metrics.test.ts.

import type { ReplyLength } from "./types.ts";

const FENCED_CODE_BLOCK_PATTERN = /```[\s\S]*?```/g;

// Openers, closers, and filler that add words without adding information.
export const FILLER_PATTERNS: RegExp[] = [
  /\blet me know\b/i,
  /\bwant me to\b/i,
  /\bwould you like\b/i,
  /\bhope this helps\b/i,
  /\bfeel free\b/i,
  /\bhappy to\b/i,
  /\bgreat question\b/i,
  /^(sure|certainly|absolutely)\b/i,
  /^(let me|i'll|i will)\b/i,
  /\bin summary\b/i,
  /\bto summarize\b/i,
  /\bin short\b/i,
  /\b(essentially|basically)\b/i,
];

export function countWords(text: string): number {
  const trimmedText = text.trim();

  return trimmedText === "" ? 0 : trimmedText.split(/\s+/).length;
}

// Code blocks are counted as lines, not words, so a short answer with a code snippet
// isn't scored as wordy.
export function measureReply(reply: string): ReplyLength {
  const codeBlocks = reply.match(FENCED_CODE_BLOCK_PATTERN) ?? [];
  const prose = reply.replace(FENCED_CODE_BLOCK_PATTERN, " ");
  const codeLines = codeBlocks.reduce((lineCount: number, codeBlock: string) => {
    const contentLines = codeBlock.split("\n").slice(1, -1);

    return lineCount + contentLines.filter((line: string) => line.trim() !== "").length;
  }, 0);

  return { proseWords: countWords(prose), codeLines: codeLines };
}

export function findFillerPhrases(reply: string): string[] {
  const trimmedReply = reply.trim();

  return FILLER_PATTERNS.filter((pattern: RegExp) => pattern.test(trimmedReply)).map(
    (pattern: RegExp) => pattern.source
  );
}
