// All database access for the bot. Uses the service-role key that Supabase
// injects into every Edge Function, so Row Level Security does not apply here
// (RLS is enabled on every table purely to keep the public REST API closed).

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface Question {
  id: string;
  genus: string;
  idx: number;
  question: string;
  answers: string[];
}

export interface ActiveQuestion {
  interaction_id: string;
  question_id: string;
  guild_id: string;
  channel_id: string | null;
  asked_by: string;
  created_at: string;
  question: Question;
}

export interface Score {
  guild_id: string;
  user_id: string;
  correct: number;
  incorrect: number;
}

/** Open questions older than this are forgotten. */
const ACTIVE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ACTIVE_SELECT = "*, question:questions(*)";

let client: SupabaseClient | null = null;

function db(): SupabaseClient {
  if (!client) {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set");
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T | null {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

/** One random question from a genus. "M" picks a random Mixtum-eligible genus first. */
export async function randomQuestion(genusCode: string): Promise<Question | null> {
  const rows = unwrap(await db().rpc("random_question", { p_genus: genusCode })) as Question[] | null;
  return rows?.[0] ?? null;
}

export interface OpenQuestionInput {
  interactionId: string;
  questionId: string;
  guildId: string;
  channelId: string | null;
  askedBy: string;
}

/** Records freshly asked questions and, in passing, forgets expired ones. */
export async function openQuestions(inputs: OpenQuestionInput[]): Promise<void> {
  const rows = inputs.map((q) => ({
    interaction_id: q.interactionId,
    question_id: q.questionId,
    guild_id: q.guildId,
    channel_id: q.channelId,
    asked_by: q.askedBy,
  }));
  const cutoff = new Date(Date.now() - ACTIVE_TTL_MS).toISOString();
  const [inserted] = await Promise.all([
    db().from("active_questions").insert(rows),
    db().from("active_questions").delete().lt("created_at", cutoff),
  ]);
  unwrap(inserted);
}

export async function activeByInteraction(interactionId: string): Promise<ActiveQuestion | null> {
  return unwrap(
    await db().from("active_questions").select(ACTIVE_SELECT).eq("interaction_id", interactionId)
      .maybeSingle(),
  ) as ActiveQuestion | null;
}

/** The most recently asked open copy of a question in this guild. */
export async function activeByQuestion(guildId: string, questionId: string): Promise<ActiveQuestion | null> {
  return unwrap(
    await db()
      .from("active_questions")
      .select(ACTIVE_SELECT)
      .eq("guild_id", guildId)
      .eq("question_id", questionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ) as ActiveQuestion | null;
}

/**
 * Removes an open question. Returns false if somebody else got there first,
 * which is how two simultaneous answers are prevented from both scoring.
 */
export async function claimActive(interactionId: string): Promise<boolean> {
  const rows = unwrap(
    await db().from("active_questions").delete().eq("interaction_id", interactionId).select("interaction_id"),
  ) as unknown[] | null;
  return (rows?.length ?? 0) > 0;
}

/** Newest open questions in a guild, for slash-command autocomplete. */
export async function recentActive(guildId: string, limit = 60): Promise<ActiveQuestion[]> {
  return (unwrap(
    await db()
      .from("active_questions")
      .select(ACTIVE_SELECT)
      .eq("guild_id", guildId)
      .order("created_at", { ascending: false })
      .limit(limit),
  ) as ActiveQuestion[] | null) ?? [];
}

export async function recordAnswer(guildId: string, userId: string, correct: boolean): Promise<Score> {
  const data = unwrap(
    await db().rpc("record_answer", { p_guild: guildId, p_user: userId, p_correct: correct }),
  );
  const row = (Array.isArray(data) ? data[0] : data) as Score | undefined;
  if (!row) throw new Error("record_answer returned nothing");
  return row;
}

export async function getScore(guildId: string, userId: string): Promise<Score> {
  const row = unwrap(
    await db().from("scores").select("*").eq("guild_id", guildId).eq("user_id", userId).maybeSingle(),
  ) as Score | null;
  return row ?? { guild_id: guildId, user_id: userId, correct: 0, incorrect: 0 };
}

/** Everyone with a score in the guild, best net score first. */
export async function leaderboard(guildId: string, limit = 50): Promise<Score[]> {
  const rows = (unwrap(
    await db().from("scores").select("*").eq("guild_id", guildId).limit(500),
  ) as Score[] | null) ?? [];
  rows.sort((a, b) => (b.correct - b.incorrect) - (a.correct - a.incorrect) || b.correct - a.correct);
  return rows.slice(0, limit);
}

/** A real database round trip, used by the keep-alive ping. Returns the genus count. */
export async function health(): Promise<number> {
  const result = await db().from("genera").select("code", { count: "exact", head: true });
  if (result.error) throw new Error(result.error.message);
  return result.count ?? 0;
}
