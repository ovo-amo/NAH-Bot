import { assertEquals } from "jsr:@std/assert@1";
import { editDistance, isCorrect, normalize, variants } from "./match.ts";
import { decodeField } from "./csv.ts";

const ok = (answers: string[], given: string, fuzzy = true) =>
  assertEquals(isCorrect(answers, given, fuzzy), true, `expected accept: ${given}`);
const no = (answers: string[], given: string, fuzzy = true) =>
  assertEquals(isCorrect(answers, given, fuzzy), false, `expected reject: ${given}`);

Deno.test("normalize strips macrons, case, markdown, punctuation and folds j/v", () => {
  assertEquals(normalize("Rōsae"), "rosae");
  assertEquals(normalize("**Julius** Caesar!"), "iulius caesar");
  assertEquals(normalize("VERGIL"), "uergil");
  assertEquals(normalize("Livius Andronicus'"), "liuius andronicus");
});

Deno.test("edit distance", () => {
  assertEquals(editDistance("kitten", "sitting"), 3);
  assertEquals(editDistance("abcd", "abdc"), 1);
  assertEquals(editDistance("same", "same"), 0);
});

Deno.test("exact and case/macron-insensitive answers", () => {
  ok(["ACRON"], "acron");
  ok(["rosae"], "Rōsae", false);
  ok(["476 AD"], "476 ad");
});

Deno.test("inflection genera are strict", () => {
  no(["rosae"], "rosam", false);
  no(["amaverunt"], "amaverant", false);
  ok(["uxor uxoris f."], "uxor uxoris", false);
  ok(["a ab abs"], "a ab abs", false);
});

Deno.test("typos tolerated only where the genus allows", () => {
  ok(["ANTHROPOMORPHISM"], "anthropomorphizm");
  ok(["VERGIL"], "Virgil");
  no(["VERGIL"], "Virgil", false);
  no(["ROME"], "rone");
});

Deno.test("parentheticals give alternatives", () => {
  const augustus = ["AUGUSTUS (or OCTAVIAN)"];
  ok(augustus, "Augustus");
  ok(augustus, "Octavian");
  no(augustus, "Tiberius");
  ok(["aeido (αειδω)"], "αειδω");
  ok(["aeido (αειδω)"], "aeido");
});

Deno.test("partial answers need at least half of the answer", () => {
  ok(["MT. OLYMPUS"], "Olympus");
  no(["MT. OLYMPUS"], "mt");
  no(["YESTERDAY"], "yes");
  no(["ACRON"], "a");
  no(["PELOPONNESIAN WAR"], "war");
  no(["FAUSTULUS & ACCA LARENTIA"], "Faustulus");
  ok(["FAUSTULUS & ACCA LARENTIA"], "Faustulus and Acca Larentia");
});

Deno.test("stray words", () => {
  no(["431 BC"], "431 AD");
  ok(["431 BC"], "431");
  no(["AUGUSTUS"], "Gaius Julius Caesar Augustus");
  ok(["THE FOX CHANGES HIS FUR> NOT HIS HABITS"].map(decodeField), "fox changes his fur not his habits");
  no(["THE FOX CHANGES HIS FUR> NOT HIS HABITS"].map(decodeField), "not his habits");
});

Deno.test("medical roots and Greek derivative formats", () => {
  ok(["**xantho-** meaning __yellow__"], "yellow");
  ok(["**xantho-** meaning __yellow__"], "xantho");
  const nano = decodeField("nan(o)-> nano- (meaning **dwarf> small**)");
  ok([nano], "nano");
  ok([nano], "dwarf");
  const logos = decodeField("word> speech> reasoning... logos (λογος)");
  ok([logos], "logos");
  ok([logos], "word");
});

Deno.test("mottoes with translations", () => {
  const motto = decodeField("PRO ECCLESIA> PRO TEXANA (`FOR CHURCH> FOR TEXAS`)");
  ok([motto], "pro ecclesia pro texana");
  ok([motto], "for church, for texas");
});

Deno.test("multiple accepted answers", () => {
  const answers = decodeField("THE DAY AFTER; ON THE FOLLOWING DAY").split(";").map((s) => s.trim());
  ok(answers, "the day after");
  ok(answers, "on the following day");
  no(answers, "the day before");
});

Deno.test("variants include the plain answer", () => {
  assertEquals(variants("ACRON").includes("acron"), true);
});
