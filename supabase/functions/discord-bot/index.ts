// Entry point of the `discord-bot` Supabase Edge Function.
//
//   POST /functions/v1/discord-bot         Discord Interactions Endpoint
//   GET  /functions/v1/discord-bot/health  keep-alive ping (touches the DB)
//
// Discord requires a reply within 3 seconds and a valid Ed25519 signature on
// every request. The function is deployed with JWT verification off
// (see supabase/config.toml) because Discord cannot send a Supabase JWT.

import {
  autocomplete,
  contextOf,
  ephemeral,
  focusedOption,
  type Interaction,
  type InteractionResponse,
  InteractionType,
  json,
  optionValue,
  ResponseType,
  verifyDiscordSignature,
} from "./discord.ts";
import * as certamen from "./certamen.ts";
import { health } from "./db.ts";

Deno.serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    try {
      return json({ ok: true, genera: await health(), at: new Date().toISOString() });
    } catch (err) {
      console.error("health check failed", err);
      return json({ ok: false, error: String(err) }, 500);
    }
  }

  if (req.method !== "POST") return new Response("Not found", { status: 404 });

  const publicKey = Deno.env.get("DISCORD_PUBLIC_KEY");
  if (!publicKey) return new Response("DISCORD_PUBLIC_KEY secret is not set", { status: 500 });

  const body = await req.text();
  const valid = verifyDiscordSignature(
    body,
    req.headers.get("x-signature-ed25519"),
    req.headers.get("x-signature-timestamp"),
    publicKey,
  );
  if (!valid) return new Response("invalid request signature", { status: 401 });

  const interaction = JSON.parse(body) as Interaction;
  if (interaction.type === InteractionType.PING) return json({ type: ResponseType.PONG });

  try {
    return json(await route(interaction));
  } catch (err) {
    console.error(
      "interaction failed",
      interaction.type,
      interaction.data?.name ?? interaction.data?.custom_id,
      err,
    );
    if (interaction.type === InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE) return json(autocomplete([]));
    return json(ephemeral("Eheu! Aliquid fractum est. (Something went wrong; please try again.)"));
  }
});

function route(interaction: Interaction): InteractionResponse | Promise<InteractionResponse> {
  const ctx = contextOf(interaction);
  const data = interaction.data ?? {};

  switch (interaction.type) {
    case InteractionType.APPLICATION_COMMAND:
      switch (data.name) {
        case "quaestio":
          return certamen.askQuestion(ctx, optionValue(interaction, "genus"));
        case "donas":
          return certamen.donateQuestions(
            ctx,
            optionValue(interaction, "genus"),
            optionValue(interaction, "receptor"),
            optionValue<number>(interaction, "numerus"),
          );
        case "respondes":
          return certamen.respondCommand(ctx, optionValue(interaction, "identitas"));
        case "deficis":
          return certamen.giveUp(ctx, optionValue(interaction, "identitas"));
        case "status":
          return certamen.status(ctx, optionValue(interaction, "histrio"));
        case "ductustabula":
          return certamen.leaderboard(ctx);
        case "auxilia":
          return certamen.HELP;
      }
      break;

    case InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE: {
      const focused = focusedOption(interaction);
      if (focused?.name === "identitas") {
        return certamen.suggestQuestionIds(ctx, String(focused.value ?? ""));
      }
      return autocomplete([]);
    }

    case InteractionType.MESSAGE_COMPONENT: {
      const id = data.custom_id ?? "";
      if (id.startsWith("new_question_button_")) {
        return certamen.askQuestion(ctx, id.slice("new_question_button_".length));
      }
      if (id.startsWith("respond_to_question_button_")) {
        return certamen.respondButton(id.slice("respond_to_question_button_".length));
      }
      break;
    }

    case InteractionType.MODAL_SUBMIT: {
      const id = data.custom_id ?? "";
      if (id.startsWith("response_input_")) {
        const interactionId = id.slice("response_input_".length);
        const response = data.components?.[0]?.components?.[0]?.value ?? "";
        return certamen.submitAnswer(ctx, interactionId, response);
      }
      break;
    }
  }

  return ephemeral("Hoc non intellego. (Unknown interaction.)");
}
