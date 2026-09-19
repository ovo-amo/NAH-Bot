# NAH-Bot (Certamen [Non-Agens Histrio])

A Discord bot for practising [Certamen](https://en.wikipedia.org/wiki/Certamen): Latin grammar and inflection
drills, Roman history, mythology, literature, derivatives and more, all answered with Latin-named slash
commands. Around 370,000 questions live in [`questions/`](questions/) as CSV files and are also published as
JSON at <https://ovo-amo.github.io/NAH-Bot/>.

Everything runs on free tiers with nothing to host yourself:

| Piece                                           | Where it runs                 | Cost                         |
| ----------------------------------------------- | ----------------------------- | ---------------------------- |
| Bot logic (`supabase/functions/discord-bot`)    | Supabase Edge Function (Deno) | Free plan                    |
| Questions, open questions, scores               | Supabase Postgres             | Free plan (≈45 MB of 500 MB) |
| Deploys, question sync, JSON export, keep-alive | GitHub Actions                | Free for public repos        |
| Question JSON                                   | GitHub Pages                  | Free for public repos        |

## How it works

1. A player runs `/quaestio <genus>`. Discord POSTs the interaction to the Edge Function, which checks
   Discord's Ed25519 signature, asks Postgres for a random question of that genus (one indexed lookup),
   records it in `active_questions`, and replies with an embed and two buttons (**Respondes** / **Novum**).
2. The player answers through the button or `/respondes` (the `identitas` option autocompletes with the
   guild's open questions). The modal text is checked by [`match.ts`](supabase/functions/_shared/match.ts),
   the question is closed and the player's `scores` row is updated atomically.
3. `/deficis` reveals the answer at the cost of an "incorrectus"; `/donas` hands up to ten questions to a
   friend; `/status`, `/ductustabula` and `/auxilia` show scores, the leaderboard and help.

Open questions are forgotten after 7 days. Scores are per Discord server (DMs count as a private server of
one).

## Repository layout

```
questions/*.csv                          the questions (source of truth)
supabase/config.toml                     CLI config (JWT verification off for the function)
supabase/migrations/*.sql                database schema + the leaderboard carried over from v1
supabase/functions/discord-bot/index.ts  HTTP entry point, signature check, routing
supabase/functions/discord-bot/certamen.ts   command / button / modal handlers
supabase/functions/discord-bot/db.ts     all database queries
supabase/functions/discord-bot/discord.ts    Discord constants, response builders
supabase/functions/_shared/genera.ts     THE list of genera (codes, names, CSV file, flags)
supabase/functions/_shared/commands.ts   slash-command definitions
supabase/functions/_shared/match.ts      answer checking (+ match_test.ts)
supabase/functions/_shared/csv.ts        CSV format + validation
scripts/build-pages.ts                   CSV → JSON for GitHub Pages
scripts/sync-questions.ts                CSV → Postgres
scripts/register-commands.ts             pushes commands.ts to Discord
.github/workflows/deploy.yml             migrations + function + secrets + commands
.github/workflows/sync-questions.yml     runs when a CSV changes
.github/workflows/pages.yml              runs when a CSV changes
.github/workflows/keepalive.yml          daily ping so Supabase does not pause the project
```

## Setting up from scratch

You need a GitHub account with this repository, a Discord account and a Supabase account. Nothing has to be
installed locally: every script runs in GitHub Actions.

### 1. Discord application

1. Open <https://discord.com/developers/applications> and create an application (or open the existing one).
2. **General Information** tab: note the **Application ID** and the **Public Key**.
3. **Bot** tab: click **Reset Token** and copy the token. It is shown once.
4. **Installation** tab: make sure the _Guild Install_ context is enabled with the `applications.commands`
   scope, and use the install link there to add the bot to a server.
5. Leave **Interactions Endpoint URL** empty for now. Discord verifies the URL the moment you save it, so the
   function must be deployed first (step 4).

### 2. Supabase project

1. Sign in at <https://supabase.com/dashboard> and create a project. Pick a US-East region (Discord's servers
   are in the US, and the function talks to the database on every request). Choose a database password and
   save it.
2. **Project Settings → General**: copy the **Project ID** (also visible in the dashboard URL,
   `…/project/<project id>`).
3. **Project Settings → API Keys**: copy the **service_role** key (under _Legacy API keys_), or create a
   _Secret key_. Either works; it must never be exposed publicly.
4. <https://supabase.com/dashboard/account/tokens>: **Generate new token** (any name) and copy it. This lets
   GitHub Actions act as you.

### 3. GitHub secrets and Pages

In the repository, **Settings → Secrets and variables → Actions → New repository secret**, add:

| Secret                      | Value                                  |
| --------------------------- | -------------------------------------- |
| `SUPABASE_ACCESS_TOKEN`     | the personal access token from 2.4     |
| `SUPABASE_PROJECT_ID`       | the project id from 2.2                |
| `SUPABASE_DB_PASSWORD`      | the database password from 2.1         |
| `SUPABASE_SERVICE_ROLE_KEY` | the service_role / secret key from 2.3 |
| `DISCORD_APP_ID`            | Application ID from 1.2                |
| `DISCORD_PUBLIC_KEY`        | Public Key from 1.2                    |
| `DISCORD_BOT_TOKEN`         | the bot token from 1.3                 |

Then **Settings → Pages → Build and deployment → Source: GitHub Actions**.

### 4. First deploy

1. Push to `main` (or open **Actions → Deploy bot → Run workflow**). The workflow applies the migrations,
   deploys the function, stores `DISCORD_PUBLIC_KEY` as a function secret and registers the slash commands.
2. Run **Actions → Sync questions to database → Run workflow** once so the questions are loaded (afterwards it
   runs by itself whenever a CSV changes). It takes a few minutes.
3. Run **Actions → Publish questions to GitHub Pages → Run workflow** once (also automatic later).
4. Back in the Discord Developer Portal, **General Information → Interactions Endpoint URL**:

   ```
   https://<project id>.supabase.co/functions/v1/discord-bot
   ```

   Save. Discord sends a signed PING; if the save succeeds the bot is live. Global commands can take up to an
   hour to appear in Discord clients the first time.

### 5. Keep the free project awake

Supabase pauses Free-plan projects after about a week with no database activity. The bot's own traffic keeps
it awake during the school year; over the summer two independent pings cover it:

- `keepalive.yml` calls `/functions/v1/discord-bot/health` (a real database query) every day. GitHub disables
  scheduled workflows in a public repository after **60 days without a commit**, so it will stop by itself
  during a long quiet spell (GitHub emails a warning; any commit re-enables it).
- Add a second ping that does not depend on the repository: create a free account at <https://cron-job.org>,
  add a job for the same `/health` URL, daily. Any similar free service (UptimeRobot, etc.) works as long as
  it requests that exact URL.

If the project is paused anyway, the dashboard shows a **Restore** button. Nothing is lost; restoring takes a
couple of minutes and the bot works again without redeploying.

## Everyday maintenance

**Add or edit questions.** Edit the CSV and push. The database sync and the Pages export run automatically.
Format (no header, no quoting):

```
H000042,Who was the first king of Rome?,ROMULUS
M000002,What is the meaning of `postridie`?,THE DAY AFTER; ON THE FOLLOWING DAY
```

- `ID` = genus code + digits, unique within the file (numbers need not be contiguous).
- Write commas as `>`, double quotes as `` ` ``, and line breaks as the two characters `\n`.
- Separate alternative answers with `;`. Parentheticals like `AUGUSTUS (or OCTAVIAN)` are also understood as
  alternatives by the checker.
- Discord Markdown (`**bold**`, `*italic*`) is allowed.

The sync fails with the file and line number if a row is malformed, and nothing is changed.

**Add a genus.** Add an entry to [`genera.ts`](supabase/functions/_shared/genera.ts) and a
`questions/<slug>.csv`, push. `fuzzy: false` disables typo tolerance (use it for anything where one letter
changes the answer, e.g. inflection). Discord allows at most 25 genera.

**Change a command's wording.** Edit [`commands.ts`](supabase/functions/_shared/commands.ts) and push; the
deploy workflow re-registers commands.

**Rotate a secret.** Update the GitHub secret, then run **Deploy bot** manually.

**Reset scores.** In the Supabase dashboard, SQL editor: `delete from scores;` (or a `where` clause for one
server).

### Answer checking

Both sides are lower-cased, macrons and accents dropped, punctuation and Markdown removed, and `j`/`v` folded
to `i`/`u`. Each accepted answer expands into variants (without parentheticals, each parenthetical alone,
`X or Y` halves, short comma lists, "root _meaning_ definition" halves, leading article dropped). An answer is
accepted when all of its words match distinct words of a variant and those words are at least half of the
variant's letters; one- and two-word answers may contain no stray word, longer ones at most one. In `fuzzy`
genera a word of five or more letters may contain one typo (two from nine letters). See
[`match_test.ts`](supabase/functions/_shared/match_test.ts) for examples of what is and is not accepted;
change the rules there first.

## Local development (optional)

Install [Deno](https://deno.com) to run `deno task test`, `deno task check` and `deno task build:pages`.
Running the function locally additionally needs the
[Supabase CLI](https://supabase.com/docs/guides/local-development) and Docker (`supabase start`,
`supabase functions serve discord-bot --no-verify-jwt --env-file .env`) plus a tunnel such as `cloudflared` so
Discord can reach it. None of this is needed for normal maintenance.
