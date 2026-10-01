// Scores a benchmark run and writes summary.md next to the raw records.
// Usage: node scripts/score.ts results/<benchmark-run> [results/<conversation-run>]
// Judge verdicts are cached in verdicts.json, so an interrupted scoring run resumes where it stopped.

import { existsSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { REPOSITORY_ROOT, readJson } from "./claude-runner.ts";
import { judgeReply } from "./judge.ts";
import { findFillerPhrases, measureReply } from "./reply-metrics.ts";
import { average, bootstrapMedianInterval, median, medianRatio, signTestPValue } from "./statistics.ts";
import type {
  ConversationTurnRecord,
  JudgeVerdict,
  PairedComparison,
  PromptDefinition,
  RunRecord,
  ScoredRecord,
} from "./types.ts";

const BASELINE_SETUP = "default";
// Every Nth reply is judged a second time to measure how consistent the judge is.
const AGREEMENT_SAMPLE_EVERY = 5;
// Two "words before answer" counts this close are treated as the same verdict.
const WORDS_BEFORE_ANSWER_TOLERANCE = 3;

type VerdictCache = Record<string, JudgeVerdict>;

function loadCache(cachePath: string): VerdictCache {
  return existsSync(cachePath) ? readJson<VerdictCache>(cachePath) : {};
}

function cachedJudge(cache: VerdictCache, cachePath: string, cacheKey: string, prompt: PromptDefinition, reply: string): JudgeVerdict {
  const cachedVerdict = cache[cacheKey];

  if (cachedVerdict !== undefined) {
    return cachedVerdict;
  }

  const verdict = judgeReply(prompt, reply);

  cache[cacheKey] = verdict;
  writeFileSync(cachePath, JSON.stringify(cache, null, 2));

  return verdict;
}

function loadRecords(benchmarkDirectory: string): Map<string, RunRecord> {
  const recordFileNames = readdirSync(benchmarkDirectory)
    .filter((fileName: string) => fileName.includes("__") && fileName.endsWith(".json") && !fileName.endsWith(".failed.json"))
    .sort();

  return new Map(
    recordFileNames.map((fileName: string) => [fileName.replace(/\.json$/, ""), readJson<RunRecord>(path.join(benchmarkDirectory, fileName))] as const)
  );
}

function groupBy<TItem>(items: TItem[], keyOf: (item: TItem) => string): Map<string, TItem[]> {
  const groups = new Map<string, TItem[]>();

  for (const item of items) {
    const key = keyOf(item);

    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return groups;
}

function proseWordsByPrompt(records: ScoredRecord[]): number[][] {
  return [...groupBy(records, (record: ScoredRecord) => record.promptId).values()].map((promptRecords: ScoredRecord[]) =>
    promptRecords.map((record: ScoredRecord) => record.proseWords)
  );
}

function promptMedians(scored: ScoredRecord[], setup: string, promptIds: string[]): number[] {
  return promptIds.map((promptId: string) =>
    median(
      scored
        .filter((record: ScoredRecord) => record.setup === setup && record.promptId === promptId)
        .map((record: ScoredRecord) => record.proseWords)
    )
  );
}

function comparePairedWithBaseline(setup: string, scored: ScoredRecord[], promptIds: string[]): PairedComparison {
  const medianFor = (setupName: string, promptId: string): number =>
    median(
      scored
        .filter((record: ScoredRecord) => record.setup === setupName && record.promptId === promptId)
        .map((record: ScoredRecord) => record.proseWords)
    );
  const differences = promptIds.map((promptId: string) => medianFor(setup, promptId) - medianFor(BASELINE_SETUP, promptId));
  const shorterOnPrompts = differences.filter((difference: number) => difference < 0).length;
  const longerOnPrompts = differences.filter((difference: number) => difference > 0).length;

  return {
    setup: setup,
    shorterOnPrompts: shorterOnPrompts,
    longerOnPrompts: longerOnPrompts,
    tiedOnPrompts: differences.length - shorterOnPrompts - longerOnPrompts,
    signTestPValue: signTestPValue(shorterOnPrompts, longerOnPrompts),
  };
}

function formatPercent(part: number, total: number): string {
  return total === 0 ? "n/a" : `${Math.round((part / total) * 100)}%`;
}

function formatPValue(pValue: number): string {
  return pValue < 0.001 ? "< 0.001" : pValue.toFixed(3);
}

function summarizeSetups(scored: ScoredRecord[], promptIds: string[]): string {
  const header = [
    "| Setup | Length vs default | Median prose words (95% CI) | Median code lines | Shorter than default | Sign test p | Correct | Task checks passed | Avg words before answer | Replies with filler | Cost per question (list price) |",
    "| - | - | - | - | - | - | - | - | - | - | - |",
  ];
  const rows = [...groupBy(scored, (record: ScoredRecord) => record.setup).entries()].map(([setup, records]: [string, ScoredRecord[]]) => {
    const interval = bootstrapMedianInterval(proseWordsByPrompt(records));
    const comparison = comparePairedWithBaseline(setup, scored, promptIds);
    const checkedRecords = records.filter((record: ScoredRecord) => record.checkPassed !== null);
    const passedChecks = checkedRecords.filter((record: ScoredRecord) => record.checkPassed === true).length;
    const correctReplies = records.filter((record: ScoredRecord) => record.verdict.correct).length;
    const repliesWithFiller = records.filter((record: ScoredRecord) => record.fillerPhrases.length > 0).length;
    const costPerQuestion = average(records.map((record: ScoredRecord) => record.costUsd + record.activationCostUsd));
    const isBaseline = setup === BASELINE_SETUP;
    const shorterCell = isBaseline ? "baseline" : `${comparison.shorterOnPrompts} of ${promptIds.length} prompts`;
    const pValueCell = isBaseline ? "" : formatPValue(comparison.signTestPValue);
    const lengthRatio = medianRatio(promptMedians(scored, setup, promptIds), promptMedians(scored, BASELINE_SETUP, promptIds));

    return [
      setup,
      `${lengthRatio.toFixed(2)}x`,
      `${interval.median} (${interval.lowerBound} to ${interval.upperBound})`,
      median(records.map((record: ScoredRecord) => record.codeLines)),
      shorterCell,
      pValueCell,
      formatPercent(correctReplies, records.length),
      formatPercent(passedChecks, checkedRecords.length),
      average(records.map((record: ScoredRecord) => record.verdict.wordsBeforeAnswer)).toFixed(1),
      formatPercent(repliesWithFiller, records.length),
      `$${costPerQuestion.toFixed(3)}`,
    ].join(" | ");
  });

  return [...header, ...rows.map((row: string) => `| ${row} |`)].join("\n");
}

function summarizePerPrompt(scored: ScoredRecord[], promptIds: string[], setups: string[]): string {
  const header = [`| Prompt | ${setups.join(" | ")} |`, `| - | ${setups.map(() => "-").join(" | ")} |`];
  const rows = promptIds.map((promptId: string) => {
    const cells = setups.map((setup: string) =>
      median(
        scored
          .filter((record: ScoredRecord) => record.setup === setup && record.promptId === promptId)
          .map((record: ScoredRecord) => record.proseWords)
      )
    );

    return `| ${promptId} | ${cells.join(" | ")} |`;
  });

  return [...header, ...rows].join("\n");
}

function summarizeConversations(conversationDirectory: string): string {
  const turnRecords = readdirSync(conversationDirectory)
    .filter((fileName: string) => fileName.includes("__") && !fileName.endsWith(".failed.json"))
    .flatMap((fileName: string) => readJson<ConversationTurnRecord[]>(path.join(conversationDirectory, fileName)));
  const turnNumbers = [...new Set(turnRecords.map((record: ConversationTurnRecord) => record.turn))].sort(
    (first: number, second: number) => first - second
  );
  const header = [
    `| Setup | ${turnNumbers.map((turn: number) => `Turn ${turn}`).join(" | ")} |`,
    `| - | ${turnNumbers.map(() => "-").join(" | ")} |`,
  ];
  const rows = [...groupBy(turnRecords, (record: ConversationTurnRecord) => record.setup).entries()].map(
    ([setup, records]: [string, ConversationTurnRecord[]]) => {
      const cells = turnNumbers.map((turn: number) =>
        Math.round(
          average(
            records.filter((record: ConversationTurnRecord) => record.turn === turn).map((record: ConversationTurnRecord) => measureReply(record.reply).proseWords)
          )
        )
      );

      return `| ${setup} | ${cells.join(" | ")} |`;
    }
  );

  return [...header, ...rows].join("\n");
}

function main(): void {
  const [benchmarkArgument, conversationArgument] = process.argv.slice(2);

  if (benchmarkArgument === undefined) {
    throw new Error("Usage: node scripts/score.ts results/<benchmark-run> [results/<conversation-run>]");
  }

  const benchmarkDirectory = path.resolve(benchmarkArgument);
  const cachePath = path.join(benchmarkDirectory, "verdicts.json");
  const cache = loadCache(cachePath);
  const prompts = readJson<PromptDefinition[]>(path.join(REPOSITORY_ROOT, "prompts", "prompts.json"));
  const promptsById = new Map(prompts.map((prompt: PromptDefinition) => [prompt.id, prompt] as const));
  const records = loadRecords(benchmarkDirectory);
  const scored: ScoredRecord[] = [];
  let agreementSamples = 0;
  let agreements = 0;

  for (const [index, [recordName, record]] of [...records.entries()].entries()) {
    const prompt = promptsById.get(record.promptId);

    if (prompt === undefined) {
      throw new Error(`Unknown prompt id ${record.promptId} in ${recordName}`);
    }

    const verdict = cachedJudge(cache, cachePath, recordName, prompt, record.reply);
    const replyLength = measureReply(record.reply);

    scored.push({ ...record, ...replyLength, fillerPhrases: findFillerPhrases(record.reply), verdict: verdict });

    if (index % AGREEMENT_SAMPLE_EVERY === 0) {
      const secondVerdict = cachedJudge(cache, cachePath, `${recordName}__second-opinion`, prompt, record.reply);
      const sameCorrectness = secondVerdict.correct === verdict.correct;
      const sameWordsBeforeAnswer = Math.abs(secondVerdict.wordsBeforeAnswer - verdict.wordsBeforeAnswer) <= WORDS_BEFORE_ANSWER_TOLERANCE;

      agreementSamples += 1;
      agreements += sameCorrectness && sameWordsBeforeAnswer ? 1 : 0;
    }
  }

  const promptIds = prompts.map((prompt: PromptDefinition) => prompt.id).filter((promptId: string) => scored.some((record: ScoredRecord) => record.promptId === promptId));
  const setups = [...new Set(scored.map((record: ScoredRecord) => record.setup))];
  const conversationSection =
    conversationArgument === undefined
      ? []
      : ["", "## Prose words per reply across a 10-turn conversation", "", summarizeConversations(path.resolve(conversationArgument))];
  const summary = [
    "# Results",
    "",
    `Replies scored: ${scored.length}. Judge agreement on a second pass: ${agreements} of ${agreementSamples} sampled replies (${formatPercent(agreements, agreementSamples)}).`,
    "",
    summarizeSetups(scored, promptIds),
    "",
    "## Median prose words per prompt",
    "",
    summarizePerPrompt(scored, promptIds, setups),
    ...conversationSection,
    "",
  ].join("\n");

  writeFileSync(path.join(benchmarkDirectory, "scored.json"), JSON.stringify(scored, null, 2));
  writeFileSync(path.join(benchmarkDirectory, "summary.md"), summary);
  process.stdout.write(`\n${summary}\n`);
}

main();
