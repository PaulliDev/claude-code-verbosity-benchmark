# Research notes

What we set out to test, how we tested it, what we found, and what we got wrong on the way.
Written on 2026-10-01. Status: **parked**. The benchmark and results are complete; the companion
article is on hold.

## Why we ran this

Long, padded replies are one of the most common complaints about Claude and Claude Code in late 2026.
Several Hacker News front-page threads in August and September 2026 were about it, including a
Claude Code bug report about "repetitive rhetorical tics" with 438 upvotes
([anthropics/claude-code#77136](https://github.com/anthropics/claude-code/issues/77136)).

People reach for different fixes: the built-in **Concise** output style, rules in `CLAUDE.md`, and
community skills such as [i-have-adhd](https://github.com/ayghri/i-have-adhd) (52,000+ GitHub stars).
We couldn't find a measured comparison of these on the same prompts, so we built one.

## Method

- **Model and tool:** Claude Code 2.1.285, Claude Opus 5.5 (recorded in `run.json` for each run).
- **Sample project:** a small TypeScript checkout module with a cart, a tax helper, and a rate limiter.
  One real bug: `addTax` doesn't round to cents, so one test fails.
- **Prompts:** 8 realistic requests: two "why/what" questions, a yes-or-no question, a lookup, a "how do I
  run" question, a code review, and two tasks (fix the failing test, add a method).
- **Repetitions:** each prompt 3 times per setup, in a fresh copy of the project every time. 96 replies.
- **Isolation:** `--setting-sources project,local`, so the tester's personal settings can't leak in.
- **Conversation test:** a scripted 10-turn conversation per setup, run twice.

### Measures

| Measure | How |
| - | - |
| Prose words | Words in the reply with fenced code blocks removed. Code is counted separately in lines. |
| Length vs default | Per prompt: setup median ÷ default median. Reported as the median of those ratios. |
| Consistency | On how many prompts the setup was shorter than the default, with an exact two-sided sign test. |
| Uncertainty | 95% cluster bootstrap interval for the median (resampling whole prompts, 5,000 iterations, fixed seed). |
| Correct | A separate model (Sonnet) grades each reply blind against a reference answer. |
| Judge consistency | Every fifth reply is graded a second time. |
| Tasks done | For task prompts, an automatic check: the tests pass, or the new method exists. |
| Words before the answer | Judged: words before the first sentence that answers the question. |
| Filler | Phrases like "let me know", "hope this helps", "want me to". |

## Results

| Setup | Length vs default | Median prose words (95% CI) | Shorter on | Sign test p | Correct | Tasks done | Words before answer | Replies with filler | Cost per question (list) |
| - | - | - | - | - | - | - | - | - | - |
| Default | 1.00× | 102 (80 to 236) | baseline | | 100% | 100% | 1.9 | 13% | $0.124 |
| `CLAUDE.md` block | 0.37× | 38 (36 to 43) | 8 of 8 | 0.008 | 100% | 100% | 1.4 | 0% | $0.117 |
| Concise style | 0.50× | 68 (44 to 99) | 8 of 8 | 0.008 | 100% | 100% | 0.6 | 17% | $0.125 |
| `i-have-adhd` | 0.81× | 109 (70 to 163) | 6 of 8 | 0.125 | 100% | 100% | 0.5 | 50% | $0.259 |

Judge agreement on the second pass: 19 of 20 sampled replies (95%).

Median prose words per prompt:

| Prompt | `CLAUDE.md` | Concise | Default | `i-have-adhd` |
| - | - | - | - | - |
| why-failing | 38 | 72 | 91 | 91 |
| safe-twice | 36 | 81 | 190 | 146 |
| fix-failing | 40 | 51 | 98 | 83 |
| explain-module | 43 | 102 | 258 | 172 |
| review-file | 174 | 208 | 425 | 293 |
| where-defined | 10 | 53 | 80 | 72 |
| add-method | 38 | 44 | 106 | 118 |
| run-one-file | 27 | 37 | 71 | 52 |

Prose words per reply across the 10-turn conversation (average of 2 runs):

| Setup | T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | T9 | T10 |
| - | - | - | - | - | - | - | - | - | - | - |
| `CLAUDE.md` | 66 | 37 | 16 | 51 | 52 | 62 | 110 | 7 | 40 | 18 |
| Concise | 140 | 65 | 38 | 125 | 104 | 154 | 265 | 25 | 68 | 33 |
| Default | 231 | 122 | 35 | 177 | 155 | 261 | 332 | 41 | 123 | 57 |
| `i-have-adhd` | 192 | 92 | 78 | 210 | 144 | 229 | 270 | 56 | 121 | 79 |

## What the data supports

- **A short `CLAUDE.md` block cut reply length the most:** about a third of the default on a typical
  prompt, shorter on all 8 prompts (p = 0.008), with no loss in correctness or task completion.
- **The Concise output style roughly halved length,** also shorter on all 8 prompts (p = 0.008).
- **No setup lost correctness.** With 24 replies per setup, the honest claim is "no drop detected",
  not "proven identical".
- **Brevity didn't wear off in our conversations.** All four setups kept their order across 10 turns.
  Two conversations per setup is a trend, not proof.
- **Shorter setups mostly cut volunteered extras,** for example pointing out the unrelated tax bug when
  asked where the tax rate is defined, and closing recaps.

## A note on i-have-adhd

`i-have-adhd` is **not designed to minimise length.** Its README describes it as a skill that "stops it from
burying the answer. Action first. Steps numbered." Its rules lead with the next action, number steps,
restate progress, give time estimates, and end with one concrete next action. Some of those add words.
The author's own evaluation ([evals/RESULTS.md](https://github.com/ayghri/i-have-adhd/blob/main/evals/RESULTS.md))
weights concision at 10% and reports gains on correctness, autonomy, actionability, and concision.

We included it because people do use it to fight wordiness. In the Hacker News discussion of the skill
(364 comments), length and verbosity came up in roughly 28 comments, by a simple keyword count. Read our
numbers accordingly:

- On **length**, its effect was smaller and not consistent across prompts (0.81×, p = 0.125).
- On its **own goal of answering first**, it had the fewest words before the answer of the four (0.5).
- Its **"filler" score is inflated by design:** its rule to end with a concrete next step ("Next: say
  'apply it'...") matches our "want me to" pattern. That's a feature of the skill, not noise.
- It costs about twice as much per question here, because switching it on with `/i-have-adhd` is an
  extra turn.
- We did not use its rubric, so none of this is a competing claim about the quality it targets.

## What we got wrong, and fixed

1. **Three reference answers were wrong, not the replies.** The first scoring pass marked 67% to 79% of
   replies incorrect in every setup. Inspection showed:
   - `add-method` expected "all tests still pass", but the tax test was already failing before the
     prompt, so no reply could meet it.
   - `review-file` treated the rate limiter's strict `>` window boundary as a bug. It's a design choice.
   - The judge only sees the final reply, so "I ran the tests and they passed" was marked as an
     unsupported claim.

   We fixed the references, told the judge it can't see actions, and re-scored. Length measures were not
   affected. After the fix, every setup scored 100% correct, and judge agreement rose from 80% to 95%.
2. **Output tokens were the wrong length measure.** They include thinking and tool calls, so a 97-word
   reply showed 1,429 output tokens. We switched to prose words.
3. **The pooled median misled.** It mixes short and long prompts, which made `i-have-adhd` look longer
   than the default overall (109 vs 102 words) although it was shorter on 6 of 8 prompts. We added the
   per-prompt ratio.
4. **A naive word count punished code.** Replies with a code snippet looked wordy, so code blocks are now
   counted separately as lines.

## Limitations

- One model, one Claude Code version, one date. Model updates can change all of this.
- One small sample project and 8 prompts. Larger codebases may behave differently.
- An LLM judge, checked for consistency but not against human graders.
- The `CLAUDE.md` block is one wording we wrote. Other wordings may do better or worse.

## Ideas for later

- Test several `CLAUDE.md` wordings to find which lines actually matter.
- Add measures for `i-have-adhd`'s own goals (answer first, numbered steps, ends with a next action) for
  all setups.
- Re-run on newer models to see whether the gap closes.
- A bigger question with the same harness: does a `CLAUDE.md` rule change behaviour at all, and how much?
