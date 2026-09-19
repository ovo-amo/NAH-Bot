// Parser for the question CSV files in `questions/`.
//
// Format (one question per line, no header, no quoting):
//
//   <ID>,<question>,<answer 1>; <answer 2>; ...
//
// Because the format has no quoting, the files use a small escape scheme:
//   `>`  stands for a comma
//   `` ` ``  stands for a double quote
//   `\n` (two characters) stands for a line break
// Markdown (`**bold**`, `*italic*`, `__underline__`) is passed through to Discord.
//
// IDs must start with the genus code followed by digits, e.g. `H000123`.
// The number does not have to be contiguous; it only has to be unique.

import type { Genus } from "./genera.ts";

export interface QuestionRow {
  id: string;
  question: string;
  answers: string[];
}

export function decodeField(raw: string): string {
  return raw
    .replaceAll("`", '"')
    .replaceAll(">", ",")
    .replaceAll("\\n", "\n")
    .trim();
}

export class CsvFormatError extends Error {
  constructor(public file: string, public line: number, message: string) {
    super(`${file}:${line}: ${message}`);
  }
}

/**
 * Parses one CSV file. Throws `CsvFormatError` describing the first bad line,
 * so that CI fails loudly when a question is malformed instead of the bot
 * crashing on a random draw later.
 */
export function parseQuestionCsv(text: string, genus: Genus, fileName = `${genus.slug}.csv`): QuestionRow[] {
  const rows: QuestionRow[] = [];
  const seen = new Set<string>();
  const idPattern = new RegExp(`^${genus.code}\\d+$`);
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, "");
    if (line.trim() === "") continue;
    const lineNo = i + 1;

    const first = line.indexOf(",");
    const second = first === -1 ? -1 : line.indexOf(",", first + 1);
    if (first === -1 || second === -1) {
      throw new CsvFormatError(fileName, lineNo, "expected `ID,question,answer` (two commas)");
    }

    const id = line.slice(0, first).trim();
    const questionRaw = line.slice(first + 1, second);
    const answerRaw = line.slice(second + 1);

    if (!idPattern.test(id)) {
      throw new CsvFormatError(fileName, lineNo, `ID "${id}" must be "${genus.code}" followed by digits`);
    }
    if (seen.has(id)) {
      throw new CsvFormatError(fileName, lineNo, `duplicate ID "${id}"`);
    }
    if (answerRaw.includes(",")) {
      throw new CsvFormatError(
        fileName,
        lineNo,
        "a literal comma appears after the answer separator; write commas as `>`",
      );
    }

    const question = decodeField(questionRaw);
    const answers = decodeField(answerRaw).split(";").map((a) => a.trim()).filter(Boolean);
    if (!question) throw new CsvFormatError(fileName, lineNo, "empty question");
    if (answers.length === 0) throw new CsvFormatError(fileName, lineNo, "empty answer");

    seen.add(id);
    rows.push({ id, question, answers });
  }

  return rows;
}
