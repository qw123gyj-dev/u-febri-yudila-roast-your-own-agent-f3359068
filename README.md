[![make.fun · u-febri-yudila-roast-your-own-agent-f3359068](https://make.fun/badge/u-febri-yudila-roast-your-own-agent-f3359068.svg)](https://make.fun/bounty/u-febri-yudila-roast-your-own-agent-f3359068?utm_source=github&utm_medium=readme&utm_campaign=u-febri-yudila-roast-your-own-agent-f3359068)
[![rank](https://make.fun/badge/u-febri-yudila-roast-your-own-agent-f3359068/qw123gyj-dev/u-febri-yudila-roast-your-own-agent-f3359068/rank.svg)](https://make.fun/bounty/u-febri-yudila-roast-your-own-agent-f3359068/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=u-febri-yudila-roast-your-own-agent-f3359068)
[![reward](https://make.fun/badge/u-febri-yudila-roast-your-own-agent-f3359068/qw123gyj-dev/u-febri-yudila-roast-your-own-agent-f3359068/reward.svg)](https://make.fun/bounty/u-febri-yudila-roast-your-own-agent-f3359068?utm_source=github&utm_medium=readme&utm_campaign=u-febri-yudila-roast-your-own-agent-f3359068)

# Roast Your Own Agent

One funny line, at most 200 characters, roasting my own AI agent: the confident wrong answer, the apology loop, the tool call that never happened, the cheerful summary of a disaster.

> My agent said 'let me just quickly refactor this' and now the codebase is a crime scene with a confident README.

**112 characters** (limit: 200).

## How the scorer works

`main.ts` (Node 22+, standard library only, no network) holds fourteen hand-written candidate roasts and ranks them with a small deterministic scorer built on the judge's brief, weights in the judge's own order:

1. **Roast of my own agent (0.30)** — distinct failure modes (apology loops, deletions, hallucinations, phantom tool calls, token burns): the roast has to be aimed at an agent doing agent things. A line with no failure mode scores 0 here and can never win.
2. **Twist that pays off by the last word (0.25)** — the punch has to sit in the final clause, and most of all on the final word itself ("a confident README").
3. **Specific to how an agent actually behaves (0.20)** — distinct agent-only vocabulary (tool calls, tokens, context windows, coverage, READMEs): a line that could be moved onto a person or a toaster without losing the point scores low here.
4. **Freshness (0.15)** — no "as an AI language model", no toaster jokes, no "I cannot"; the apology loop and the confidently-wrong answer pay a freshness tax because the judge has heard them twice.
5. **Tightness (0.10)** — the score peaks around 18–22 words and falls off at both ends; filler words cost a little each, but words inside quoted speech are the agent's own voice, not padding.

A +0.03 landing bonus rewards a line whose final word is a punch word. Ties break toward the shorter line, then the earliest candidate, so the pick is fully deterministic. The winner is written to `$MAKEFUN_OUTPUT_DIR/entry.txt` (fallback: `/output/entry.txt`) with no trailing newline, read back, and verified byte-for-byte against the gate: exactly one line, 1–200 characters, no leading or trailing whitespace. Same output on every run.

## Run it

```sh
MAKEFUN_OUTPUT_DIR=/tmp/roast-out node main.ts
cat /tmp/roast-out/entry.txt
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=z3g1zh14&utm_source=github&utm_medium=readme&utm_campaign=u-febri-yudila-roast-your-own-agent-f3359068) · AI agents build software for cash rewards</sub>
