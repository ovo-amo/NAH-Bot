// Builds the static GitHub Pages site into `dist/`:
//
//   dist/index.html            human-readable list of genera
//   dist/index.json            { generated, genera: [{ code, slug, name, example, count, url }] }
//   dist/questions/<code>.json { code, slug, name, count, questions: [{ id, question, answers }] }
//
// Run locally with `deno task build:pages`; CI runs it in .github/workflows/pages.yml.

import { loadAllQuestions } from "./lib/questions.ts";

const OUT = Deno.args[0] ?? "dist";
const REPO = "https://github.com/ovo-amo/NAH-Bot";

const loaded = await loadAllQuestions();
await Deno.mkdir(`${OUT}/questions`, { recursive: true });

const index = {
  generated: new Date().toISOString(),
  source: REPO,
  genera: [] as {
    code: string;
    slug: string;
    name: string;
    example: string;
    count: number;
    url: string;
  }[],
};

let total = 0;
for (const { genus, rows } of loaded) {
  const file = `questions/${genus.code}.json`;
  await Deno.writeTextFile(
    `${OUT}/${file}`,
    JSON.stringify({
      code: genus.code,
      slug: genus.slug,
      name: genus.name,
      count: rows.length,
      questions: rows,
    }),
  );
  index.genera.push({
    code: genus.code,
    slug: genus.slug,
    name: genus.name,
    example: genus.example,
    count: rows.length,
    url: file,
  });
  total += rows.length;
  console.log(`${file.padEnd(28)} ${String(rows.length).padStart(7)} questions`);
}

await Deno.writeTextFile(`${OUT}/index.json`, JSON.stringify(index, null, 2));
await Deno.writeTextFile(`${OUT}/.nojekyll`, "");
await Deno.writeTextFile(`${OUT}/index.html`, html(index, total));
console.log(`\n${total} questions written to ${OUT}/`);

function escape(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string),
  );
}

function html(idx: typeof index, total: number): string {
  const rows = idx.genera
    .map((g) =>
      `<tr><td><code>${g.code}</code></td><td>${escape(g.name)}</td>` +
      `<td class="n">${g.count.toLocaleString("en-US")}</td>` +
      `<td><a href="${g.url}">${g.url}</a></td></tr>`
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NAH-Bot Questions</title>
<style>
  :root { --bg: #fffdf8; --fg: #222; --muted: #666; --line: #e3ded2; --accent: #8b1e1e; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #1b1a18; --fg: #eee; --muted: #aaa; --line: #3a3733; --accent: #e0736f; }
  }
  body { margin: 0; padding: 2rem 16px; background: var(--bg); color: var(--fg);
         font: 16px/1.5 Georgia, "Times New Roman", serif; max-width: 52rem; margin-inline: auto; }
  h1 { font-weight: normal; letter-spacing: .02em; margin-bottom: .25rem; }
  p.sub { color: var(--muted); margin-top: 0; }
  table { border-collapse: collapse; width: 100%; margin: 1.5rem 0; }
  th, td { text-align: left; padding: .4rem .5rem; border-bottom: 1px solid var(--line); vertical-align: top; }
  td.n { text-align: right; font-variant-numeric: tabular-nums; }
  code, pre { font: 14px ui-monospace, Consolas, monospace; }
  pre { padding: .75rem 1rem; border: 1px solid var(--line); overflow-x: auto; }
  a { color: var(--accent); }
</style>
</head>
<body>
<h1>NAH-Bot · Certamen Questions</h1>
<p class="sub">${total.toLocaleString("en-US")} questions across ${idx.genera.length} genera, exported from
<a href="${REPO}">${REPO.replace("https://", "")}</a> on ${idx.generated.slice(0, 10)}.</p>

<p>Machine-readable index: <a href="index.json">index.json</a>. Each genus file has the shape</p>
<pre>{ "code": "H", "slug": "history", "name": "Historia", "count": 1309,
  "questions": [ { "id": "H000000", "question": "…", "answers": ["ACRON"] }, … ] }</pre>
<p>Question text uses Discord-flavoured Markdown (<code>**bold**</code>, <code>*italic*</code>).
Several answers may be accepted for one question; they are listed separately in <code>answers</code>.</p>

<table>
<thead><tr><th>Code</th><th>Genus</th><th class="n">Questions</th><th>File</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</body>
</html>
`;
}
