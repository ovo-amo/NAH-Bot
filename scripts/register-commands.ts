// Registers (overwrites) the bot's global slash commands with Discord.
// Run automatically by the deploy workflow; safe to run any time.
//
// Environment: DISCORD_APP_ID, DISCORD_BOT_TOKEN
// Global commands can take up to an hour to appear in Discord clients.

import { COMMANDS } from "../supabase/functions/_shared/commands.ts";

const appId = Deno.env.get("DISCORD_APP_ID");
const token = Deno.env.get("DISCORD_BOT_TOKEN");
if (!appId || !token) {
  console.error("Set DISCORD_APP_ID and DISCORD_BOT_TOKEN.");
  Deno.exit(1);
}

const res = await fetch(`https://discord.com/api/v10/applications/${appId}/commands`, {
  method: "PUT",
  headers: {
    Authorization: `Bot ${token}`,
    "Content-Type": "application/json; charset=UTF-8",
    "User-Agent": "DiscordBot (https://github.com/ovo-amo/NAH-Bot, 2.0.0)",
  },
  body: JSON.stringify(COMMANDS),
});

if (!res.ok) {
  console.error(`Discord returned ${res.status}:`, await res.text());
  Deno.exit(1);
}

const registered = (await res.json()) as { name: string }[];
console.log(`Registered ${registered.length} commands: ${registered.map((c) => `/${c.name}`).join(", ")}`);
