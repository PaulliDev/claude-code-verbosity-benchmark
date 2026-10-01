# Claude Code Verbosity Benchmark

A small, reproducible experiment: **which setup makes Claude Code give shorter answers, without
giving worse ones?** It runs the same questions through four Claude Code setups, measures how much
Claude writes, and checks with a blind judge and automatic task checks that the answers are still right.

Built by [Snippets Ltd](https://snippets.ltd). A companion article is planned. See
[RESEARCH.md](RESEARCH.md) for the full write-up of what we measured, what we found, and what we got wrong
along the way.

## Results at a glance

Claude Code 2.1.285, Claude Opus 5.5, 8 prompts × 3 repetitions per setup (96 replies), scored on 2026-09-30.

| Setup | Length vs default | Median prose words (95% CI) | Shorter than default | Sign test p | Correct | Tasks done |
| - | - | - | - | - | - | - |
| Default | 1.00× | 102 (80 to 236) | baseline | | 100% | 100% |
| `CLAUDE.md` block | **0.37×** | 38 (36 to 43) | 8 of 8 prompts | 0.008 | 100% | 100% |
| Concise output style | **0.50×** | 68 (44 to 99) | 8 of 8 prompts | 0.008 | 100% | 100% |
| `i-have-adhd` skill | 0.81× | 109 (70 to 163) | 6 of 8 prompts | 0.125 | 100% | 100% |

- A four-line response-style block in `CLAUDE.md` gave the shortest replies on every prompt.
- The built-in Concise output style roughly halved reply length.
- `i-have-adhd` is designed for a different goal: putting the answer and the next action first, not
  minimum length. See [RESEARCH.md](RESEARCH.md#a-note-on-i-have-adhd) before reading its row as a verdict.
- One model, one small sample project, eight prompts: treat this as an experiment, not a study.

Full tables: [`results/benchmark-2026-09-30T20-11-12-382Z/summary.md`](results/benchmark-2026-09-30T20-11-12-382Z/summary.md).

## The four setups

| Setup | What it is | Files |
| - | - | - |
| `default` | Claude Code with no changes | none |
| `concise` | The built-in Concise output style | [`setups/concise/overlay/.claude/settings.json`](setups/concise/overlay/.claude/settings.json) |
| `claude-md` | A four-line "answer first, keep it short" block | [`setups/claude-md/overlay/CLAUDE.md`](setups/claude-md/overlay/CLAUDE.md) |
| `i-have-adhd` | The [i-have-adhd](https://github.com/ayghri/i-have-adhd) skill (MIT), switched on with `/i-have-adhd` | Downloaded at a pinned commit, see [`setups/i-have-adhd/setup.json`](setups/i-have-adhd/setup.json) |

## How it works

1. Every run copies [`sample-project/`](sample-project) (a tiny checkout module with one real bug) into a
   temporary folder and applies the setup.
2. It asks one prompt from [`prompts/prompts.json`](prompts/prompts.json) with `claude -p`, using
   `--setting-sources project,local` so your personal `~/.claude` settings and `CLAUDE.md` can't affect it.
3. Task prompts are checked automatically: "fix the failing test" must leave the tests passing, and
   "add `removeItem`" must actually add it.
4. [`scripts/score.ts`](scripts/score.ts) measures each reply and asks a separate Claude model (Sonnet) to
   grade it blind against a reference answer. Every fifth reply is graded twice to measure judge agreement.

What gets measured:

- **Prose words**: words you actually read. Code blocks are counted separately as lines, so a short answer
  with a snippet isn't scored as wordy.
- **Length vs default**: for each prompt, the setup's median divided by the default's, then the median of
  those ratios.
- **Shorter than default + sign test**: on how many of the 8 prompts the setup was shorter, and the chance
  of seeing that by luck (exact two-sided sign test).
- **95% CI**: a cluster bootstrap that resamples whole prompts, because replies to the same prompt aren't
  independent.
- **Correct / tasks done / words before the answer / filler phrases / cost**.

[`scripts/run-conversation.ts`](scripts/run-conversation.ts) also runs a 10-turn conversation per setup to
see whether brevity wears off.

## Run it yourself

Requirements: Node.js 22.18 or newer (it runs TypeScript directly) and Claude Code, logged in.
This repository never handles an API key; it uses your installed `claude` CLI.

```bash
git clone https://github.com/PaulliDev/claude-code-verbosity-benchmark.git
cd claude-code-verbosity-benchmark
npm install          # TypeScript and Node types, for the type check only
npm test             # unit tests for the scoring and statistics
npm run bench -- --prompts where-defined --repetitions 1   # a cheap first run
npm run bench        # the full benchmark: 4 setups x 8 prompts x 3 repetitions
npm run conversation # the 10-turn conversations
npm run score -- results/<benchmark-run> results/<conversation-run>
```

**Cost:** each run is a real Claude Code session and counts against your plan or API usage. At API list
prices our full benchmark was about $0.12 per question ($0.26 for `i-have-adhd`, which needs an extra turn
to switch on), plus the judge. Start small.

Interrupted? Run the same command again with `--output results/<folder>`: finished runs are skipped,
and scoring reuses cached verdicts.

### Test your own setup

1. Copy `setups/claude-md` to `setups/my-setup`.
2. Put your files in `setups/my-setup/overlay/` (a `CLAUDE.md`, `.claude/settings.json`, skills, anything).
3. `npm run bench -- --setups default,my-setup`

## Project structure

```
sample-project/        the code every prompt runs against
prompts/               prompts.json (with reference answers and checks), conversation.json
setups/<name>/         setup.json plus an overlay/ folder copied into the project
scripts/               runners, scoring, judge, statistics
tests/                 unit tests for the pure functions
results/               raw records, judge verdicts, and summary.md for each run
```

## License

MIT. The `i-have-adhd` skill is MIT-licensed by its author and is downloaded at run time, not included here.
