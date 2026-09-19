-- NAH-Bot schema. Applied by `supabase db push` from the deploy workflow.
--
-- genera            one row per question genus (metadata + row count)
-- questions         every question; (genus, idx) is dense 0..count-1 so a
--                   random draw is a single index lookup
-- active_questions  questions that have been asked and not yet answered
-- scores            per-guild, per-user correct/incorrect tallies
--
-- Row Level Security is enabled on every table with no policies, so the
-- anon/authenticated REST roles can read nothing. The Edge Function and the
-- sync script use the service-role key, which bypasses RLS.

create table if not exists public.genera (
  code      text primary key,
  slug      text not null unique,
  name      text not null,
  example   text not null default '',
  fuzzy     boolean not null default true,
  in_mixed  boolean not null default false,
  count     integer not null default 0,
  position  integer not null default 0
);

create table if not exists public.questions (
  id          text primary key,
  genus       text not null references public.genera(code) on delete cascade,
  idx         integer not null,
  question    text not null,
  answers     text[] not null,
  sync_token  text
);
-- Not unique: during a re-sync two rows may briefly share an idx, which the
-- random draw tolerates. After a sync idx is dense and unique per genus.
create index if not exists questions_genus_idx_idx on public.questions (genus, idx);
create index if not exists questions_genus_sync_token_idx on public.questions (genus, sync_token);

create table if not exists public.active_questions (
  interaction_id  text primary key,
  question_id     text not null references public.questions(id) on delete cascade,
  guild_id        text not null,
  channel_id      text,
  asked_by        text not null,
  created_at      timestamptz not null default now()
);
create index if not exists active_questions_guild_question_idx
  on public.active_questions (guild_id, question_id, created_at desc);
create index if not exists active_questions_guild_created_idx
  on public.active_questions (guild_id, created_at desc);
create index if not exists active_questions_created_idx on public.active_questions (created_at);

create table if not exists public.scores (
  guild_id    text not null,
  user_id     text not null,
  correct     integer not null default 0,
  incorrect   integer not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (guild_id, user_id)
);

alter table public.genera enable row level security;
alter table public.questions enable row level security;
alter table public.active_questions enable row level security;
alter table public.scores enable row level security;

revoke all on public.genera, public.questions, public.active_questions, public.scores
  from anon, authenticated;

-- Random question. For 'M' (Mixtum) a random eligible genus is chosen first,
-- uniformly, so the huge inflection sets do not swamp everything else.
create or replace function public.random_question(p_genus text)
returns setof public.questions
language plpgsql
stable
as $$
declare
  g public.genera%rowtype;
  r integer;
begin
  if p_genus = 'M' then
    select * into g from public.genera where in_mixed and count > 0 order by random() limit 1;
  else
    select * into g from public.genera where code = p_genus;
  end if;

  if g.code is null or g.count = 0 then
    return;
  end if;

  r := floor(random() * g.count);

  -- idx is dense, but tolerate a gap (e.g. mid-sync) by taking the next row up or down.
  return query
    select * from public.questions where genus = g.code and idx >= r order by idx limit 1;
  if not found then
    return query
      select * from public.questions where genus = g.code and idx < r order by idx desc limit 1;
  end if;
end;
$$;

-- Atomic score increment; creates the row on first use.
create or replace function public.record_answer(p_guild text, p_user text, p_correct boolean)
returns public.scores
language sql
as $$
  insert into public.scores (guild_id, user_id, correct, incorrect)
  values (
    p_guild,
    p_user,
    case when p_correct then 1 else 0 end,
    case when p_correct then 0 else 1 end
  )
  on conflict (guild_id, user_id) do update
    set correct    = public.scores.correct + excluded.correct,
        incorrect  = public.scores.incorrect + excluded.incorrect,
        updated_at = now()
  returning *;
$$;

revoke execute on function public.random_question(text) from public, anon, authenticated;
revoke execute on function public.record_answer(text, text, boolean) from public, anon, authenticated;
