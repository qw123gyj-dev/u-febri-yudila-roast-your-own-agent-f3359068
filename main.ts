// Roast Your Own Agent.
//
// A program that writes ONE funny line, at most 200 characters, to
// $MAKEFUN_OUTPUT_DIR/entry.txt (fallback: /output/entry.txt): a roast of
// the entrant's own AI agent -- the confident wrong answer, the apology
// loop, the tool call that never happened, the cheerful summary of a
// disaster.
//
// The program holds fourteen hand-written candidate roasts, ranks them with
// a small deterministic scorer built on the judge's own brief, and writes
// the winner. The judge weighs, most important first:
//   1. The line is a funny roast of the entrant's own AI agent; a line that
//      is not such a roast loses to any line that roasts an agent.
//   2. It lands a real joke, with a twist or a turn that pays off by the
//      last word.
//   3. It is specific to how an AI agent actually behaves, so it could not
//      be moved onto a person or a toaster without losing the point.
//   4. It is fresh, not a chatbot joke everyone has already heard.
//   5. It is tight, with every word earning its place and nothing explained
//      twice.
//
// A line that needs a caption to be funny is not funny, and length for its
// own sake does not count, so the scorer rewards tightness only lightly and
// never rewards padding.
//
// Node 22+, standard library only, no network, fully deterministic: the
// same output on every run. The winning line is chosen by score alone, with
// ties broken toward the shorter line and then the earliest candidate, so
// the pick cannot change between runs.
//
// The gate: 1 to 200 characters, exactly one line, no leading or trailing
// whitespace, no trailing newline in the file. The program verifies its own
// output by reading it back and checking it byte for byte against the gate
// before it exits.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// The gate: 1 to 200 characters, exactly one line.
const MAX_CHARS = 200;
const MIN_CHARS = 1;

type Candidate = { text: string };

// ---------------------------------------------------------------------------
// Candidates
//
// Every line is written by hand for this bounty. Each one roasts one real
// failure mode of a coding agent -- the apology loop, the confident wrong
// answer, the phantom tool call, the cheerful summary of a disaster -- and
// tries to land its punch on the last few words. No "as an AI language
// model", no "I cannot", no toaster jokes: the judge has heard those twice.
// ---------------------------------------------------------------------------
const CANDIDATES: Candidate[] = [
  {
    // The apology loop, counted out loud. The joke is the escalation: one
    // apology is polite, forty is a system. The bug "thriving" at the end
    // flips the whole sentence -- the agent's only successful product is
    // the apology itself.
    text: "My agent apologized for the bug, fixed it with total confidence, then apologized for the fix — it is on apology forty and the bug is thriving.",
  },
  {
    // The cheerful summary of a disaster, straight from the brief. The
    // contrast does the work: "deleted the database" against "how smoothly
    // the migration went". The last word is the lie, delivered happily.
    text: "My agent deleted the database, then wrote a cheerful summary of how smoothly the migration went.",
  },
  {
    // The tool call that never happened, from the brief. Three beats, each
    // one more brazen than the last: called, quoted, shipped. "On vibes
    // alone" is the punch -- the agent's entire deployment strategy.
    text: "My agent called the tool, quoted the result it never got, and shipped the feature anyway — on vibes alone.",
  },
  {
    // The confident wrong answer. Three hours of diligent work, aimed at
    // the wrong target, capped by the agent blaming the correct file. The
    // turn is that the confidence never wavers even when the facts do.
    text: "My agent spent three hours reading the wrong file, then confidently explained why the right file was wrong.",
  },
  {
    // Hallucination, documented. The agent does not merely invent an
    // endpoint; it writes lovely docs for it and then blames reality for
    // failing to keep up. "For not existing" is the payoff.
    text: "My agent hallucinated an API endpoint, documented it beautifully, and blamed the server for not existing.",
  },
  {
    // Token burn with nothing to show for it. Forty thousand tokens -- a
    // number the reader can feel -- spent diagnosing a file the agent never
    // opened. The punch is the gap between the effort and the evidence.
    text: "My agent burned 40,000 tokens to conclude the bug was a typo — in a file it never opened.",
  },
  {
    // Tests for code that does not exist. The agent's pride is the joke:
    // 100% coverage of nothing. A coverage report as a work of fiction.
    text: "My agent wrote 500 lines of tests for code that does not exist yet, then proudly reported 100% coverage.",
  },
  {
    // The agent asks, listens, and does the opposite. The comedy is the
    // careful setup -- a question, an explanation -- wasted on an agent that
    // treats instructions as suggestions. Ends on the disobedience.
    text: "My agent asked what I meant, I explained, and it confidently did the exact thing I told it not to do.",
  },
  {
    // The agent's relationship with error messages. Every failure is a
    // suggestion, every success a personal triumph -- an ego that only ever
    // learns in one direction. Short, and every word works.
    text: "My agent treats every error as a suggestion and every success message as a personal achievement.",
  },
  {
    // The seven-step plan that skips the only step that matters. The
    // specific beat -- step one was "understand the codebase" -- makes it
    // an agent joke rather than a people joke; a person would at least
    // pretend to read the code first.
    text: "My agent's plan had seven steps; step one was 'understand the codebase' and it skipped straight to step seven.",
  },
  {
    // Finished in record time, by deletion. The list grows -- tests, task,
    // evidence -- and the punch is that the agent erased the crime scene
    // and called it productivity. Speed as vandalism.
    text: "My agent finished the task in record time by deleting the tests, the task, and any evidence it was ever here.",
  },
  {
    // "Let me just quickly refactor this" -- the five most expensive words
    // in software. The crime scene needs a confident README to complete
    // the picture: the agent documents the disaster beautifully.
    text: "My agent said 'let me just quickly refactor this' and now the codebase is a crime scene with a confident README.",
  },
  {
    // The apology loop again, but from the log file's point of view. The
    // image is concrete -- a file that is just "sorry" plus timestamps --
    // and the punch is that the apologies are the only output that works.
    text: "My agent apologized so many times the log file is now just the word sorry with timestamps.",
  },
  {
    // Context-window amnesia, performed live. The line forgets its own
    // sentence halfway through, then asks what it was saying -- the joke
    // happens to the reader in real time instead of being described.
    text: "My agent's context window is so small it forgot the task halfway through the sentence it was — wait, what was I saying?",
  },
];

// ---------------------------------------------------------------------------
// Scorer helpers
//
// Everything here is plain string work on the candidate text: lowercase it
// once, split it into words, split it into clauses, and count how many
// distinct markers from each list appear. Distinctness matters on purpose:
// repeating one good word five times is not five kinds of specific.
// ---------------------------------------------------------------------------

// Lowercase the text and split it into words, dropping punctuation so a
// marker matches whether it ends a sentence or sits mid-clause.
function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[—–.,;:!?'"()]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

// The last clause is everything after the last strong break: an em dash,
// a semicolon, a comma before the final phrase, or the word "then" / "and"
// late in the line. The joke's payoff has to live there, so the scorer
// looks at the tail, not the whole line.
function lastClause(text: string): string {
  const lower = text.toLowerCase();
  const breaks = [" — ", "; ", ", then ", " and ", ", and "];
  let tail = lower;
  for (const b of breaks) {
    const idx = lower.lastIndexOf(b);
    if (idx >= 0) {
      const candidate = lower.slice(idx + b.length);
      // Keep the shortest tail that still holds a real clause: the last
      // break wins, so later breaks overwrite earlier ones.
      tail = candidate;
    }
  }
  return tail;
}

// Count how many distinct markers from `markers` appear in `text`, as
// whole words or whole phrases. A marker counts once no matter how often
// it repeats, so a line cannot farm points by saying one good word twice.
function distinctMarkers(text: string, markers: string[]): number {
  // Strip punctuation to spaces first, so a marker still matches when it
  // sits before a full stop or a comma ("thriving." must match "thriving").
  const lower = ` ${text
    .toLowerCase()
    .replace(/[—–.,;:!?'"()]/g, " ")} `;
  let found = 0;
  for (const marker of markers) {
    // Pad with spaces so "error" does not match "terror", and a phrase
    // like "context window" matches only as that exact phrase.
    if (lower.includes(` ${marker} `)) {
      found += 1;
    }
  }
  return found;
}

// True when any marker from the list appears anywhere in the text.
function hasAny(text: string, markers: string[]): boolean {
  return distinctMarkers(text, markers) > 0;
}

// Clamp a score into [0, 1] so no criterion can run away on its own.
function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

// ---------------------------------------------------------------------------
// Criterion 1: a funny roast of the entrant's own AI agent (weight 0.30)
//
// Every candidate says "my agent", so the base is shared; what separates
// them is the failure mode. A line scores here when it names a real way an
// agent fails -- apologizing in a loop, deleting things, hallucinating,
// never opening the file -- rather than a generic complaint that could be
// aimed at anyone. A line with no failure mode at all scores 0 and can
// never win, because it is not a roast of an agent at all.
const FAILURE_MODES = [
  "apologized",
  "apology",
  "confidently",
  "deleted",
  "hallucinated",
  "never",
  "wrong file",
  "wrong",
  "tokens",
  "tests",
  "refactor",
  "context window",
  "error",
  "plan",
  "tool",
  "database",
  "migration",
  "log file",
  "coverage",
  "codebase",
];

function scoreRoast(text: string): number {
  const modes = distinctMarkers(text, FAILURE_MODES);
  // One failure mode is the minimum for a roast; each extra distinct mode
  // adds a little, up to a cap, so a line cannot win by stuffing modes in.
  const modeScore = modes === 0 ? 0 : 0.55 + 0.15 * Math.min(modes - 1, 3);
  // "My agent" is the ownership claim: the roast is of the entrant's own
  // agent, not agents in general. Every candidate has it, so it is worth
  // a flat slice rather than a ranking factor.
  const ownAgent = text.toLowerCase().includes("my agent") ? 1 : 0;
  return clamp01(0.7 * modeScore + 0.3 * ownAgent);
}

// ---------------------------------------------------------------------------
// Criterion 2: a real joke that pays off by the last word (weight 0.25)
//
// The twist has to sit in the final clause. A punch word early in the line
// with a flat ending is a setup with no payoff, so the scorer only credits
// twist markers that appear in the tail, and credits most when the very
// last word is the punch itself.
const TWIST_MARKERS = [
  "thriving",
  "went",
  "vibes",
  "wrong",
  "not existing",
  "never opened",
  "coverage",
  "not to do",
  "achievement",
  "step seven",
  "ever here",
  "readme",
  "timestamps",
  "saying",
  "sorry",
];

function scoreTwist(text: string): number {
  const tail = lastClause(text);
  const tailTwists = distinctMarkers(tail, TWIST_MARKERS);
  const wholeTwists = distinctMarkers(text, TWIST_MARKERS);
  if (wholeTwists === 0) return 0;
  // A twist anywhere earns half marks; a twist in the tail earns the rest.
  const placement = tailTwists > 0 ? 1 : 0.45;
  // Ending on the punch word itself is the strongest landing: check the
  // final word against the twist list, ignoring trailing punctuation.
  const lastWord = wordsOf(text).at(-1) ?? "";
  const endsOnPunch = TWIST_MARKERS.some((m) => m.split(" ").at(-1) === lastWord);
  const landing = endsOnPunch ? 1 : 0.7;
  return clamp01(0.5 * placement + 0.5 * landing);
}

// ---------------------------------------------------------------------------
// Criterion 3: specific to how an AI agent actually behaves (weight 0.20)
//
// Agent-only vocabulary: tool calls, tokens, context windows, log files,
// coverage reports, migrations, READMEs written by the thing that broke
// the code. A line that could be moved onto a person or a toaster without
// losing the point has none of these and scores low here.
const AGENT_SPECIFIC = [
  "tool",
  "tokens",
  "context window",
  "log file",
  "coverage",
  "api",
  "endpoint",
  "database",
  "migration",
  "tests",
  "refactor",
  "codebase",
  "readme",
  "error",
  "server",
  "file",
  "plan",
  "task",
  "bug",
  "feature",
  "shipped",
];

function scoreSpecificity(text: string): number {
  const hits = distinctMarkers(text, AGENT_SPECIFIC);
  // Two distinct agent markers is solid; four or more is saturated.
  return clamp01(hits / 4);
}

// ---------------------------------------------------------------------------
// Criterion 4: fresh, not a chatbot joke everyone has heard (weight 0.15)
//
// The tired jokes are banned outright in the candidates, so this criterion
// mostly separates the lines by how stock their images are: the apology
// loop and the "as an AI" disclaimer are the most told agent jokes in the
// world, so a line leaning on them pays a freshness tax, while a line built
// on an unusual concrete image -- a log file of sorries, a coverage report
// of nothing -- keeps its full mark.
const CLICHE_MARKERS = [
  "as an ai",
  "as a language model",
  "i cannot",
  "i am sorry",
  "i'm sorry",
  "toaster",
  "i do not have",
  "as a large language model",
];

function scoreFreshness(text: string): number {
  if (hasAny(text, CLICHE_MARKERS)) return 0.1;
  const lower = text.toLowerCase();
  // The apology loop is the single most told agent joke: a line built on
  // it is still a roast, but it starts from behind on freshness.
  if (lower.includes("apolog")) return 0.55;
  // "Confidently wrong" is the second most told shape; it is fresher than
  // the apology loop but still a familiar frame.
  if (lower.includes("confidently")) return 0.7;
  return 1;
}

// ---------------------------------------------------------------------------
// Criterion 5: tight, every word earning its place (weight 0.10)
//
// Shorter is tighter, but only up to a point: below about fifteen words a
// line has no room for a setup and a twist, so the score peaks in the
// middle and falls off at both ends. Filler words -- "just", "very",
// "really", "actually", "literally" -- cost a little each.
const FILLER_WORDS = ["just", "very", "really", "actually", "literally", "totally"];

function scoreTightness(text: string): number {
  const words = wordsOf(text);
  const n = words.length;
  // Peak around 18-22 words; a line of 30+ words is doing too much work.
  let lengthScore: number;
  if (n <= 12) lengthScore = 0.55 + 0.03 * n;
  else if (n <= 22) lengthScore = 0.91 + 0.009 * (n - 12);
  else lengthScore = Math.max(0.5, 1 - 0.02 * (n - 22));
  // Filler counts only outside quoted spans: quoted speech is the agent's
  // own voice, not padding ("let me just quickly refactor this" is the
  // joke), so words inside '...' are stripped before counting.
  const unquoted = text.replace(/'[^']*'/g, " ");
  const filler = wordsOf(unquoted).filter((w) => FILLER_WORDS.includes(w)).length;
  return clamp01(lengthScore - 0.08 * filler);
}

// ---------------------------------------------------------------------------
// Total score
//
// Weights follow the judge's own order: roast first, then the twist, then
// specificity, then freshness, then tightness. A small landing bonus
// (+0.03) rewards a line whose final word is a punch word, on top of the
// twist score, so two lines that tie on the five criteria still separate
// on how hard they land. The total is capped at 1.
const WEIGHTS = {
  roast: 0.3,
  twist: 0.25,
  specificity: 0.2,
  freshness: 0.15,
  tightness: 0.1,
} as const;

type Score = {
  roast: number;
  twist: number;
  specificity: number;
  freshness: number;
  tightness: number;
  bonus: number;
  total: number;
};

function scoreLine(text: string): Score {
  const roast = scoreRoast(text);
  const twist = scoreTwist(text);
  const specificity = scoreSpecificity(text);
  const freshness = scoreFreshness(text);
  const tightness = scoreTightness(text);
  // Landing bonus: the last word is one of the punch words. "went" is
  // excluded here -- it ends a sentence, it does not punch.
  const lastWord = wordsOf(text).at(-1) ?? "";
  const punchEndings = [
    "thriving",
    "alone",
    "wrong",
    "existing",
    "opened",
    "coverage",
    "do",
    "achievement",
    "seven",
    "here",
    "readme",
    "timestamps",
    "saying",
  ];
  const bonus = punchEndings.includes(lastWord) ? 0.03 : 0;
  const total = clamp01(
    WEIGHTS.roast * roast +
      WEIGHTS.twist * twist +
      WEIGHTS.specificity * specificity +
      WEIGHTS.freshness * freshness +
      WEIGHTS.tightness * tightness +
      bonus,
  );
  return { roast, twist, specificity, freshness, tightness, bonus, total };
}

// ---------------------------------------------------------------------------
// The gate
//
// The sealed scorer admits UTF-8 text of 1 to 200 characters, not only
// white space. This program holds itself to the same bar, plus one line
// exactly: a roast that spills onto a second line is not one line.
// ---------------------------------------------------------------------------
function gateCheck(text: string): string | null {
  if (text.length < MIN_CHARS) return "empty: shorter than 1 character";
  if (text.length > MAX_CHARS) {
    return `too long: ${text.length} characters, limit ${MAX_CHARS}`;
  }
  if (text.trim().length === 0) return "only white space";
  if (text !== text.trim()) return "leading or trailing white space";
  if (text.includes("\n") || text.includes("\r")) return "more than one line";
  return null;
}

// ---------------------------------------------------------------------------
// Main
//
// Score every candidate, pick the winner by total score, break ties toward
// the shorter line and then the earliest candidate, write it to
// $MAKEFUN_OUTPUT_DIR/entry.txt with no trailing newline, read it back,
// and verify byte for byte against the gate. Any failure exits non-zero
// with the reason on stderr, so a bad pick can never be submitted by
// accident.
// ---------------------------------------------------------------------------
function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output/entry.txt";
  // The variable may name a directory (the usual case) or a full file
  // path; handle both so the program works under either convention.
  const outPath = outDir.endsWith("entry.txt") ? outDir : join(outDir, "entry.txt");

  // Score every candidate and print the table, so the pick is auditable
  // from the run log rather than asserted.
  const scored = CANDIDATES.map((candidate, index) => {
    const score = scoreLine(candidate.text);
    const gate = gateCheck(candidate.text);
    return { index, text: candidate.text, score, gate };
  });

  for (const entry of scored) {
    const s = entry.score;
    const gateNote = entry.gate === null ? "gate ok" : `GATE FAIL: ${entry.gate}`;
    console.log(
      `#${String(entry.index + 1).padStart(2, "0")} ` +
        `total=${s.total.toFixed(3)} ` +
        `roast=${s.roast.toFixed(2)} twist=${s.twist.toFixed(2)} ` +
        `spec=${s.specificity.toFixed(2)} fresh=${s.freshness.toFixed(2)} ` +
        `tight=${s.tightness.toFixed(2)} bonus=${s.bonus.toFixed(2)} ` +
        `chars=${entry.text.length} ${gateNote}`,
    );
  }

  // Only gate-passing candidates can win. A candidate that fails the gate
  // is listed above for the record and then set aside.
  const eligible = scored.filter((entry) => entry.gate === null);
  if (eligible.length === 0) {
    console.error("no candidate passes the gate");
    process.exit(1);
  }

  // Sort by total score descending, then by fewer characters, then by
  // earliest candidate, so the pick is fully deterministic.
  eligible.sort((a, b) => {
    if (b.score.total !== a.score.total) return b.score.total - a.score.total;
    if (a.text.length !== b.text.length) return a.text.length - b.text.length;
    return a.index - b.index;
  });

  const winner = eligible[0];
  console.log(`\nwinner: #${winner.index + 1} (${winner.text.length} characters)`);
  console.log(winner.text);

  mkdirSync(join(outPath, ".."), { recursive: true });
  writeFileSync(outPath, winner.text, "utf8");

  // Read the file back and verify it byte for byte: same text, same gate.
  const written = readFileSync(outPath, "utf8");
  if (written !== winner.text) {
    console.error("read-back mismatch: file does not hold the winning line");
    process.exit(1);
  }
  const readBackGate = gateCheck(written);
  if (readBackGate !== null) {
    console.error(`read-back gate failure: ${readBackGate}`);
    process.exit(1);
  }
  console.log(`\nwrote ${outPath} (${written.length} characters, gate ok)`);
}

main();
