// Loads every genus's CSV from `questions/`, validating as it goes.
// Shared by the GitHub Pages build and the database sync.

import { GENERA, type Genus } from "../../supabase/functions/_shared/genera.ts";
import { parseQuestionCsv, type QuestionRow } from "../../supabase/functions/_shared/csv.ts";

export interface LoadedGenus {
  genus: Genus;
  rows: QuestionRow[];
}

export async function loadAllQuestions(root = "questions"): Promise<LoadedGenus[]> {
  const out: LoadedGenus[] = [];
  for (const genus of GENERA) {
    const path = `${root}/${genus.slug}.csv`;
    let text: string;
    try {
      text = await Deno.readTextFile(path);
    } catch {
      throw new Error(`${path} is missing (every genus in genera.ts needs a CSV file)`);
    }
    const rows = parseQuestionCsv(text, genus, path);
    out.push({ genus, rows });
  }
  return out;
}
