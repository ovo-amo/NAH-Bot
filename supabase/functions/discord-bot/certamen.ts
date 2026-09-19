// Game logic: one handler per slash command, button and modal. Every handler
// returns the JSON body of the interaction response.

import { findGenus, GENERA, type Genus, GENUS_BY_CODE } from "../_shared/genera.ts";
import { isCorrect } from "../_shared/match.ts";
import { roman } from "../_shared/roman.ts";
import {
  actionRow,
  answerModal,
  autocomplete,
  button,
  ButtonStyle,
  type Context,
  ephemeral,
  type InteractionResponse,
  message,
} from "./discord.ts";
import * as db from "./db.ts";

const NOT_FOUND =
  "Hic identitas vera non est. (No open question has that ID. It may have been answered already.)";
const ALREADY_DONE = "Haec quaestio iam responsa est. (That question was already answered or given up.)";

const HOW_TO_ANSWER =
  "Respond with the button below or `/respondes` (or give up with `/deficis` to see the answer).";

function novumButton(genus: Genus) {
  return button(`new_question_button_${genus.code}`, "Novum", ButtonStyle.SECONDARY);
}

function scoreFields(score: db.Score) {
  return [
    { name: "Correctus", value: roman(score.correct), inline: true },
    { name: "Incorrectus", value: roman(score.incorrect), inline: true },
  ];
}

// ---- /quaestio and the Novum button ----------------------------------------

export async function askQuestion(ctx: Context, genusCodeOrSlug: string): Promise<InteractionResponse> {
  const requested = findGenus(genusCodeOrSlug);
  if (!requested) return ephemeral("Hoc genus non exstat. (Unknown genus.)");

  const q = await db.randomQuestion(requested.code);
  if (!q) {
    return ephemeral(`Nullae quaestiones in genere **${requested.name}** sunt. (No questions loaded yet.)`);
  }
  const drawn = GENUS_BY_CODE[q.genus] ?? requested;

  await db.openQuestions([{
    interactionId: ctx.interactionId,
    questionId: q.id,
    guildId: ctx.guildId,
    channelId: ctx.channelId,
    askedBy: ctx.userId,
  }]);

  return message({
    embeds: [{
      title: "Certamen Quaestionem",
      description: `${q.question}\n\n${HOW_TO_ANSWER}`,
      fields: [
        { name: "Qui postulavit?", value: `<@${ctx.userId}>`, inline: true },
        { name: "Genus", value: drawn.name, inline: true },
      ],
      footer: { text: `Question ID: ${q.id}` },
    }],
    components: [
      actionRow(
        button(`respond_to_question_button_${ctx.interactionId}`, "Respondes", ButtonStyle.PRIMARY),
        novumButton(requested),
      ),
    ],
  });
}

// ---- /donas ------------------------------------------------------------------

export async function donateQuestions(
  ctx: Context,
  genusCode: string,
  recipientId: string,
  count: number,
): Promise<InteractionResponse> {
  const genus = findGenus(genusCode);
  if (!genus) return ephemeral("Hoc genus non exstat. (Unknown genus.)");
  count = Math.min(10, Math.max(1, Math.floor(count)));

  const chosen: db.Question[] = [];
  for (let i = 0; i < count; i++) {
    // A few attempts to avoid handing out the same question twice; tiny genera
    // may still repeat, which is harmless.
    for (let attempt = 0; attempt < 5; attempt++) {
      const q = await db.randomQuestion(genus.code);
      if (!q) break;
      if (!chosen.some((c) => c.id === q.id) || attempt === 4) {
        chosen.push(q);
        break;
      }
    }
  }
  if (chosen.length === 0) return ephemeral(`Nullae quaestiones in genere **${genus.name}** sunt.`);

  await db.openQuestions(chosen.map((q, i) => ({
    interactionId: `${ctx.interactionId}_${i}`,
    questionId: q.id,
    guildId: ctx.guildId,
    channelId: ctx.channelId,
    askedBy: ctx.userId,
  })));

  const ids = chosen.map((q) => q.id);
  return message({
    embeds: [{
      title: "Donum Certaminis Quaestionum",
      description:
        `<@${ctx.userId}> donated **${roman(chosen.length)}** question${
          chosen.length === 1 ? "" : "s"
        } to <@${recipientId}>! ` +
        `Answer with \`/respondes\` (the IDs appear in the autocomplete list).`,
      fields: [
        ...chosen.map((q, i) => ({
          name: `${i + 1}. ${q.id} · ${GENUS_BY_CODE[q.genus]?.name ?? genus.name}`,
          value: truncate(q.question, 1024),
        })),
      ],
      footer: { text: `Question ID${ids.length === 1 ? "" : "s"}: ${ids.join("; ")}` },
    }],
  });
}

// ---- Answering ---------------------------------------------------------------

/** `/respondes <id>`: open the answer modal for an open question. */
export async function respondCommand(ctx: Context, questionId: string): Promise<InteractionResponse> {
  const active = await db.activeByQuestion(ctx.guildId, questionId.trim());
  if (!active) return ephemeral(NOT_FOUND);
  return answerModal(active.interaction_id);
}

/** The "Respondes" button under a question. */
export async function respondButton(interactionId: string): Promise<InteractionResponse> {
  const active = await db.activeByInteraction(interactionId);
  if (!active) return ephemeral(ALREADY_DONE);
  return answerModal(interactionId);
}

/** Modal submission: check the answer, score it, close the question. */
export async function submitAnswer(
  ctx: Context,
  interactionId: string,
  response: string,
): Promise<InteractionResponse> {
  const active = await db.activeByInteraction(interactionId);
  if (!active) return ephemeral(ALREADY_DONE);
  if (!(await db.claimActive(interactionId))) return ephemeral(ALREADY_DONE);

  const q = active.question;
  const genus = GENUS_BY_CODE[q.genus];
  const verdict = isCorrect(q.answers, response, genus?.fuzzy ?? true);
  const score = await db.recordAnswer(ctx.guildId, ctx.userId, verdict);

  return message({
    embeds: [{
      title: "Certamen Quaestionem",
      description:
        `Responsum tuum (*${truncate(response, 300)}*) est... **${verdict ? "bonum" : "malum"}**. ` +
        `Responsum in systemate est *${q.answers.join("; ")}*.`,
      fields: [
        { name: "Qui respondit?", value: `<@${ctx.userId}>`, inline: true },
        ...scoreFields(score),
      ],
      footer: { text: `Question ID: ${q.id}` },
    }],
    components: [actionRow(novumButton(genus ?? GENERA[0]))],
  });
}

/** `/deficis <id>`: give up, reveal the answer, take an incorrect. */
export async function giveUp(ctx: Context, questionId: string): Promise<InteractionResponse> {
  const active = await db.activeByQuestion(ctx.guildId, questionId.trim());
  if (!active) return ephemeral(NOT_FOUND);
  if (!(await db.claimActive(active.interaction_id))) return ephemeral(ALREADY_DONE);

  const q = active.question;
  const genus = GENUS_BY_CODE[q.genus] ?? GENERA[0];
  const score = await db.recordAnswer(ctx.guildId, ctx.userId, false);

  return message({
    embeds: [{
      title: "Certamen Quaestionem Defectus",
      description: `Eheu! Responsum in systemate est *${q.answers.join("; ")}*.`,
      fields: [
        { name: "Qui defecit?", value: `<@${ctx.userId}>`, inline: true },
        ...scoreFields(score),
      ],
      footer: { text: `Question ID: ${q.id}` },
    }],
    components: [actionRow(novumButton(genus))],
  });
}

/** Autocomplete for the `identitas` option of /respondes and /deficis. */
export async function suggestQuestionIds(ctx: Context, typed: string): Promise<InteractionResponse> {
  const needle = typed.trim().toLowerCase();
  const recent = await db.recentActive(ctx.guildId);
  const seen = new Set<string>();
  const choices: { name: string; value: string }[] = [];

  for (const a of recent) {
    if (seen.has(a.question_id)) continue;
    const text = a.question.question.replace(/\s+/g, " ");
    if (needle && !a.question_id.toLowerCase().startsWith(needle) && !text.toLowerCase().includes(needle)) {
      continue;
    }
    seen.add(a.question_id);
    choices.push({ name: truncate(`${a.question_id} · ${text}`, 100), value: a.question_id });
    if (choices.length === 25) break;
  }
  return autocomplete(choices);
}

// ---- Scores ------------------------------------------------------------------

export async function status(ctx: Context, userId: string): Promise<InteractionResponse> {
  const score = await db.getScore(ctx.guildId, userId);
  return message({
    embeds: [{
      title: "Status Histrionis",
      description: `Hi sunt stati <@${userId}>.`,
      fields: scoreFields(score),
    }],
  });
}

export async function leaderboard(ctx: Context): Promise<InteractionResponse> {
  const rows = await db.leaderboard(ctx.guildId);
  const lines = rows.map((s, i) =>
    `${i + 1}. <@${s.user_id}> (correctus: ${roman(s.correct)}, incorrectus: ${roman(s.incorrect)})`
  );
  return message({
    embeds: [{
      title: "Stati Histrionum",
      description: lines.length > 0
        ? lines.join("\n")
        : "Nemo adhuc respondit. (Nobody has answered a question here yet.)",
    }],
  });
}

// ---- /auxilia ----------------------------------------------------------------

export const HELP: InteractionResponse = message({
  embeds: [
    {
      title: "Auxilium",
      description:
        "Need help studying for Certamen, but don't want to make a Quizlet? This is for you. Below is the list of question genera available.\n\n" +
        "Use `/quaestio` for most purposes, `/ductustabula` to show a leaderboard, `/donas` to *donate* questions to a friend, `/status` to see someone's score. " +
        "When answering with `/respondes` or `/deficis`, start typing and pick the question from the list. Please contact `timothyc.` with questions.",
      fields: GENERA.map((g) => ({ name: g.name, value: g.example, inline: true })),
    },
    {
      title: "Pro Latin Is",
      description:
        "Are you a Latin I? Try starting with `Inflectis pro Latinos Quintos` (`Grammatica` is pretty misleading and kind of boring + advanced, so don't do that one if you're looking to practice your grammar). " +
        "Or, if for some crazy reason grammar isn't your thing, try\n\n" +
        "‣ `Historia` (history),\n‣ `Fabula` (myth),\n‣ `PMAQ` (phrases, mottoes, abbreviations, and quotations),\n" +
        "‣ `Cultura et Vita Cotidiana` (culture and daily life),\n‣ `Derivativus Graecus` (Greek derivatives),\n‣ or `Derivativus` (normal derivatives).\n\n" +
        "The other categories are for later and you don't need to study those, for now.",
    },
  ],
});

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1) + "…";
}
