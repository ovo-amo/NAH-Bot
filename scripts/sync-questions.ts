// Loads the CSVs in `questions/` into the Supabase database.
//
// Idempotent: rows are upserted by ID, then any row of the genus that this run
// did not touch is deleted, and the genus row count is refreshed. Genera that
// no longer exist in genera.ts are removed together with their questions.
//
// Environment:
//   SUPABASE_URL               https://<project-ref>.supabase.co
//                              (or set SUPABASE_PROJECT_ID and it is derived)
//   SUPABASE_SERVICE_ROLE_KEY  the project's service-role / secret API key
//
// CI runs this from .github/workflows/sync-questions.yml whenever a CSV changes.

import { createClient } from "npm:@supabase/supabase-js@2";
import { GENERA } from "../supabase/functions/_shared/genera.ts";
import { loadAllQuestions } from "./lib/questions.ts";

const BATCH = 500;
const CONCURRENCY = 4;

const url = Deno.env.get("SUPABASE_URL") ??
  (Deno.env.get("SUPABASE_PROJECT_ID")
    ? `https://${Deno.env.get("SUPABASE_PROJECT_ID")}.supabase.co`
    : undefined);
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !key) {
  console.error("Set SUPABASE_URL (or SUPABASE_PROJECT_ID) and SUPABASE_SERVICE_ROLE_KEY.");
  Deno.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const token = crypto.randomUUID();

function check<T>(label: string, res: { error: { message: string } | null; data: T }): T {
  if (res.error) throw new Error(`${label}: ${res.error.message}`);
  return res.data;
}

const started = Date.now();
const loaded = await loadAllQuestions();

// 1. Genus metadata (count is refreshed after each genus's rows are in).
check(
  "upsert genera",
  await supabase.from("genera").upsert(
    GENERA.map((g, i) => ({
      code: g.code,
      slug: g.slug,
      name: g.name,
      example: g.example,
      fuzzy: g.fuzzy,
      in_mixed: g.inMixed,
      position: i,
    })),
    { onConflict: "code" },
  ),
);

// 2. Questions, genus by genus.
for (const { genus, rows } of loaded) {
  const payload = rows.map((r, idx) => ({
    id: r.id,
    genus: genus.code,
    idx,
    question: r.question,
    answers: r.answers,
    sync_token: token,
  }));

  const batches: typeof payload[] = [];
  for (let i = 0; i < payload.length; i += BATCH) batches.push(payload.slice(i, i + BATCH));

  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, batches.length) }, async () => {
      while (next < batches.length) {
        const batch = batches[next++];
        check(`upsert ${genus.code}`, await supabase.from("questions").upsert(batch, { onConflict: "id" }));
      }
    }),
  );

  check(
    `prune ${genus.code}`,
    await supabase
      .from("questions")
      .delete()
      .eq("genus", genus.code)
      .or(`sync_token.is.null,sync_token.neq.${token}`),
  );
  check("update count", await supabase.from("genera").update({ count: rows.length }).eq("code", genus.code));

  console.log(`${genus.code.padEnd(7)} ${String(rows.length).padStart(7)} rows  (${genus.slug}.csv)`);
}

// 3. Genera removed from genera.ts (their questions cascade).
check(
  "prune genera",
  await supabase.from("genera").delete().not("code", "in", `(${GENERA.map((g) => g.code).join(",")})`),
);

const total = loaded.reduce((n, g) => n + g.rows.length, 0);
console.log(`\nSynced ${total} questions in ${Math.round((Date.now() - started) / 1000)}s.`);
