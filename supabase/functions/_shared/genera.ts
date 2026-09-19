// The list of question genera ("genera" is the Latin plural of "genus").
//
// This file is the single source of truth for genus metadata. It is imported by
// the Edge Function (embed labels, button ids), by the command-registration
// script (slash-command choices) and by the question sync / GitHub Pages
// build scripts (which CSV file belongs to which code).
//
// Adding a genus: add an entry here AND a `questions/<slug>.csv` file whose
// IDs start with `code` (e.g. `PW000000`). Discord allows at most 25 choices
// per slash-command option, so at most 25 genera can exist.

export interface Genus {
  /** ID prefix and database key, e.g. "H". Must match the CSV row IDs. */
  code: string;
  /** CSV file name without extension, e.g. "history". */
  slug: string;
  /** Latin display name shown to players. */
  name: string;
  /** Example shown by /auxilia. */
  example: string;
  /**
   * Whether small typos are tolerated when checking answers. Inflection and
   * grammar drills must be exact: "amaverunt" and "amaverant" differ by one
   * letter and are different tenses.
   */
  fuzzy: boolean;
  /** Whether Mixtum (random genus) may draw from this genus. */
  inMixed: boolean;
}

export const MIXED_CODE = "M";

export const GENERA: Genus[] = [
  {
    code: "G",
    slug: "grammar",
    name: "Grammatica",
    example: "Find the proper form of the incorrect word in `Grumio in culinam cenam non parat.`",
    fuzzy: false,
    inMixed: false,
  },
  {
    code: "H",
    slug: "history",
    name: "Historia",
    example: "Who was emperor during the most famous volcanic eruption where Grumio lived?",
    fuzzy: true,
    inMixed: true,
  },
  {
    code: "F",
    slug: "myth",
    name: "Fabula",
    example: "Although Grumio could never have cooked it, what is the food of the gods?",
    fuzzy: true,
    inMixed: true,
  },
  {
    code: "L",
    slug: "literature",
    name: "Littera",
    example: "What Latin cookbook has the same name as its author?",
    fuzzy: true,
    inMixed: true,
  },
  {
    code: "C",
    slug: "culture_daily_life",
    name: "Cultura et Vita Cotidiana",
    example: "If Grumio were cooking, what part of the house would he be in?",
    fuzzy: true,
    inMixed: true,
  },
  {
    code: "P",
    slug: "pmaq",
    name: "PMAQ",
    example: "What is the Latin motto of Grumio's birthplace, the University of Cambridge?",
    fuzzy: true,
    inMixed: true,
  },
  {
    code: "T",
    slug: "translation",
    name: "Translatio",
    example: "Translate `Grumio erat mendax, quod cenam optimam non parabat.`",
    fuzzy: true,
    inMixed: true,
  },
  {
    code: "I",
    slug: "inflection",
    name: "Inflectis",
    example: "Give the 2nd-person singular present active imperative of `cenam paro`.",
    fuzzy: false,
    inMixed: false,
  },
  {
    code: "D",
    slug: "derivative",
    name: "Derivativus",
    example: "Although Grumio could never have cooked it, what Latin root does `biscuit` have?",
    fuzzy: true,
    inMixed: true,
  },
  {
    code: "A",
    slug: "greek_derivatives",
    name: "Derivativus Graecus",
    example: "What Greek root is most related to the word `bake`?",
    fuzzy: true,
    inMixed: true,
  },
  {
    code: "LFIFTH",
    slug: "LFIFTH_inflection",
    name: "Inflectis pro Latinos Quintos",
    example: "Inflection for Latin 0.2s.",
    fuzzy: false,
    inMixed: false,
  },
  {
    code: "LHALF",
    slug: "LHALF_inflection",
    name: "Inflectis pro Latina Dimidia",
    example: "Inflection for Latin 0.5s.",
    fuzzy: false,
    inMixed: false,
  },
  {
    code: "L1",
    slug: "L1_inflection",
    name: "Inflectis pro Latinos Unos",
    example: "Inflection for Latin Is.",
    fuzzy: false,
    inMixed: false,
  },
  {
    code: "L2",
    slug: "L2_inflection",
    name: "Inflectis pro Latinos Duos",
    example: "Inflection for Latin IIs.",
    fuzzy: false,
    inMixed: false,
  },
  {
    code: "LADV",
    slug: "LADV_inflection",
    name: "Inflectis pro Latinos Tres et Plures",
    example: "Inflection for Latin ADVs (III+).",
    fuzzy: false,
    inMixed: false,
  },
  {
    code: "PW",
    slug: "pw",
    name: "Πόλεμος τῶν Πελοποννησίων",
    example: "Peloponnesian War.",
    fuzzy: true,
    inMixed: true,
  },
  {
    code: "GMDR",
    slug: "gmdr",
    name: "Radices Graecae Medicinae",
    example: "What Greek root gives *peptide*?",
    fuzzy: true,
    inMixed: true,
  },
  {
    code: "E",
    slug: "empire",
    name: "Historia Imperii Romani",
    example: "My favorite emperor is *pupienus*. Grumio's is *Metellus*.",
    fuzzy: true,
    inMixed: true,
  },
  {
    code: MIXED_CODE,
    slug: "mixed",
    name: "Mixtum",
    example: "A random question from any of the non-inflection genera above (plus a few extras).",
    fuzzy: true,
    inMixed: true,
  },
];

export const GENUS_BY_CODE: Record<string, Genus> = Object.fromEntries(
  GENERA.map((g) => [g.code, g]),
);

export const GENUS_BY_SLUG: Record<string, Genus> = Object.fromEntries(
  GENERA.map((g) => [g.slug, g]),
);

/** Accepts either a code ("H") or a legacy slug ("history") from old button ids. */
export function findGenus(codeOrSlug: string): Genus | undefined {
  return GENUS_BY_CODE[codeOrSlug] ?? GENUS_BY_SLUG[codeOrSlug];
}

if (GENERA.length > 25) {
  throw new Error("Discord allows at most 25 choices per option; too many genera.");
}
