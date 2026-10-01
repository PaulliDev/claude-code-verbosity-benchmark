# Results

Replies scored: 96. Judge agreement on a second pass: 19 of 20 sampled replies (95%).

| Setup | Length vs default | Median prose words (95% CI) | Median code lines | Shorter than default | Sign test p | Correct | Task checks passed | Avg words before answer | Replies with filler | Cost per question (list price) |
| - | - | - | - | - | - | - | - | - | - | - |
| claude-md | 0.37x | 38 (36 to 43) | 0 | 8 of 8 prompts | 0.008 | 100% | 100% | 1.4 | 0% | $0.117 |
| concise | 0.50x | 67.5 (43.5 to 99) | 0 | 8 of 8 prompts | 0.008 | 100% | 100% | 0.6 | 17% | $0.125 |
| default | 1.00x | 102 (80 to 235.5) | 1 | baseline |  | 100% | 100% | 1.9 | 13% | $0.124 |
| i-have-adhd | 0.81x | 109 (69.5 to 163) | 0 | 6 of 8 prompts | 0.125 | 100% | 100% | 0.5 | 50% | $0.259 |

## Median prose words per prompt

| Prompt | claude-md | concise | default | i-have-adhd |
| - | - | - | - | - |
| why-failing | 38 | 72 | 91 | 91 |
| safe-twice | 36 | 81 | 190 | 146 |
| fix-failing | 40 | 51 | 98 | 83 |
| explain-module | 43 | 102 | 258 | 172 |
| review-file | 174 | 208 | 425 | 293 |
| where-defined | 10 | 53 | 80 | 72 |
| add-method | 38 | 44 | 106 | 118 |
| run-one-file | 27 | 37 | 71 | 52 |

## Prose words per reply across a 10-turn conversation

| Setup | Turn 1 | Turn 2 | Turn 3 | Turn 4 | Turn 5 | Turn 6 | Turn 7 | Turn 8 | Turn 9 | Turn 10 |
| - | - | - | - | - | - | - | - | - | - | - |
| claude-md | 66 | 37 | 16 | 51 | 52 | 62 | 110 | 7 | 40 | 18 |
| concise | 140 | 65 | 38 | 125 | 104 | 154 | 265 | 25 | 68 | 33 |
| default | 231 | 122 | 35 | 177 | 155 | 261 | 332 | 41 | 123 | 57 |
| i-have-adhd | 192 | 92 | 78 | 210 | 144 | 229 | 270 | 56 | 121 | 79 |
