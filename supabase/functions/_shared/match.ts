// Answer checking.
//
// The old bot ran a fuzzy *substring* search of the player's text inside the
// accepted answers, which accepted "a" or "yes" for almost anything while
// rejecting single-letter typos. This module does the opposite:
//
//   1. Both sides are normalised: lower-cased, macrons/accents stripped,
//      markdown and punctuation removed, j→i and v→u (Latin spelling).
//   2. Each accepted answer is expanded into *variants*: the text without
//      parentheticals, each parenthetical on its own ("AUGUSTUS (or OCTAVIAN)"
//      gives "augustus" and "octavian"), "X or Y" / "X / Y" alternatives,
//      short comma lists ("dwarf, small"), "root meaning definition" halves
//      for the medical-roots genus, and leading article / "to" dropped.
//   3. The player's answer matches a variant when every one of its words
//      matches a distinct word of the variant and the matched words make up at
//      least half of the variant's letters. Short answers (one or two words)
//      may contain no unmatched words; longer ones may contain one stray word.
//   4. When the genus allows it, a word matches with one typo if it has at
//      least 5 letters, or two typos with at least 9 letters. Inflection and
//      grammar genera never allow typos (see `Genus.fuzzy`).

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "of",
  "to",
  "and",
  "in",
  "on",
  "at",
  "for",
  "with",
  "by",
]);

export function normalize(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // combining marks: macrons, accents, breathings
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[*_`~]/g, "") // markdown emphasis
    .replace(/'/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // any other punctuation becomes a space
    .replace(/j/g, "i")
    .replace(/v/g, "u")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(normalized: string): string[] {
  const all = normalized.split(" ").filter(Boolean);
  const meaningful = all.filter((t) => !STOPWORDS.has(t));
  return meaningful.length > 0 ? meaningful : all;
}

/** Expands one accepted answer into the normalised strings a player may type. */
export function variants(raw: string): string[] {
  const out = new Set<string>();
  const add = (s: string) => {
    const n = normalize(s);
    if (n) out.add(n);
  };

  add(raw);

  const parenPattern = /\(([^()]*)\)/g;
  const withoutParens = raw.replace(parenPattern, " ");
  add(withoutParens);
  add(raw.replace(parenPattern, "$1")); // "nan(o)-" → "nano-"

  for (const m of raw.matchAll(parenPattern)) {
    const inner = m[1].replace(/^\s*(or|meaning|i\.e\.|e\.g\.|and)\s+/i, "");
    add(inner);
    for (const alt of splitAlternatives(inner)) add(alt);
  }

  for (const alt of splitAlternatives(withoutParens)) add(alt);

  // "**xantho-** meaning __yellow__" → "xantho-" and "yellow"
  for (const half of withoutParens.split(/\s+meaning\s+/i)) add(half);

  for (const v of [...out]) {
    const stripped = v.replace(/^(the|a|an|to) /, "");
    if (stripped !== v) out.add(stripped);
  }

  return [...out];
}

/**
 * Splits "X or Y", "X / Y" and short comma/ellipsis lists ("dwarf, small",
 * "word, speech, reasoning... logos") into alternatives. Comma lists are only
 * split when every piece is at most three words, so that a sentence with a
 * comma in it ("the fox changes his fur, not his habits") stays whole.
 */
function splitAlternatives(text: string): string[] {
  const out: string[] = [];
  const orParts = text.split(/\s+or\s+|\s*\/\s*/i).map((p) => p.trim()).filter(Boolean);
  if (orParts.length > 1) out.push(...orParts);

  const commaParts = text.split(/\s*,\s*|\.{3}\s*|…\s*/).map((p) => p.trim()).filter(Boolean);
  if (commaParts.length > 1 && commaParts.every((p) => tokens(normalize(p)).length <= 3)) {
    out.push(...commaParts);
  }
  return out;
}

/** Optimal string alignment distance (Levenshtein with adjacent transpositions). */
export function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

function wordsMatch(given: string, expected: string, fuzzy: boolean): boolean {
  if (given === expected) return true;
  if (!fuzzy) return false;
  const shorter = Math.min(given.length, expected.length);
  if (shorter < 5) return false;
  const allowed = shorter >= 9 ? 2 : 1;
  return editDistance(given, expected) <= allowed;
}

function matchesVariant(givenTokens: string[], variant: string, fuzzy: boolean): boolean {
  const expected = tokens(variant);
  if (expected.length === 0) return false;
  const totalLetters = expected.reduce((n, t) => n + t.length, 0);

  const used = new Array<boolean>(expected.length).fill(false);
  let matchedLetters = 0;
  let unmatched = 0;

  for (const g of givenTokens) {
    let hit = -1;
    for (let i = 0; i < expected.length; i++) {
      if (!used[i] && wordsMatch(g, expected[i], fuzzy)) {
        hit = i;
        break;
      }
    }
    if (hit === -1) {
      unmatched++;
    } else {
      used[hit] = true;
      matchedLetters += expected[hit].length;
    }
  }

  const allowedUnmatched = givenTokens.length <= 2 ? 0 : 1;
  if (unmatched > allowedUnmatched) return false;
  if (matchedLetters === 0) return false;
  return matchedLetters * 2 >= totalLetters;
}

/**
 * Returns true when `given` should be accepted for any of `answers`.
 * `fuzzy` comes from the genus (see genera.ts).
 */
export function isCorrect(answers: string[], given: string, fuzzy: boolean): boolean {
  const g = normalize(given);
  if (!g) return false;
  const givenTokens = tokens(g);

  for (const answer of answers) {
    for (const v of variants(answer)) {
      if (g === v) return true;
      if (matchesVariant(givenTokens, v, fuzzy)) return true;
    }
  }
  return false;
}
