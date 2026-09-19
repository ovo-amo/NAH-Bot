// Discord interaction plumbing: request verification, constants, response
// builders and the small subset of the interaction payload the bot reads.
// Reference: https://docs.discord.com/developers/interactions/receiving-and-responding

import nacl from "npm:tweetnacl@1.0.3";

export const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
  APPLICATION_COMMAND_AUTOCOMPLETE: 4,
  MODAL_SUBMIT: 5,
} as const;

export const ResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  APPLICATION_COMMAND_AUTOCOMPLETE_RESULT: 8,
  MODAL: 9,
} as const;

export const ComponentType = { ACTION_ROW: 1, BUTTON: 2, TEXT_INPUT: 4 } as const;
export const ButtonStyle = { PRIMARY: 1, SECONDARY: 2 } as const;
export const EPHEMERAL = 1 << 6;

export interface InteractionOption {
  name: string;
  type: number;
  value?: string | number | boolean;
  focused?: boolean;
  options?: InteractionOption[];
}

export interface Interaction {
  id: string;
  type: number;
  token: string;
  guild_id?: string;
  channel_id?: string;
  member?: { user: { id: string } };
  user?: { id: string };
  data?: {
    name?: string;
    custom_id?: string;
    options?: InteractionOption[];
    components?: { components: { custom_id: string; value: string }[] }[];
  };
}

/** Where the interaction came from, normalised for guild and DM use. */
export interface Context {
  interactionId: string;
  userId: string;
  /** Real guild id, or a per-user pseudo guild for DMs so scores still work. */
  guildId: string;
  channelId: string | null;
}

export function contextOf(interaction: Interaction): Context {
  const userId = interaction.member?.user.id ?? interaction.user?.id ?? "unknown";
  return {
    interactionId: interaction.id,
    userId,
    guildId: interaction.guild_id ?? `dm-${userId}`,
    channelId: interaction.channel_id ?? null,
  };
}

export function optionValue<T = string>(interaction: Interaction, name: string): T {
  const opt = interaction.data?.options?.find((o) => o.name === name);
  if (!opt || opt.value === undefined) throw new Error(`missing option "${name}"`);
  return opt.value as T;
}

export function focusedOption(interaction: Interaction): InteractionOption | undefined {
  return interaction.data?.options?.find((o) => o.focused);
}

/**
 * Verifies Discord's Ed25519 signature. `body` must be the raw request text,
 * exactly as received. Returns false for any missing or malformed header.
 */
export function verifyDiscordSignature(
  body: string,
  signature: string | null,
  timestamp: string | null,
  publicKeyHex: string,
): boolean {
  if (!signature || !timestamp) return false;
  try {
    return nacl.sign.detached.verify(
      new TextEncoder().encode(timestamp + body),
      hexToBytes(signature),
      hexToBytes(publicKeyHex),
    );
  } catch {
    return false;
  }
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) throw new Error("bad hex");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

// ---- Response builders -----------------------------------------------------

// deno-lint-ignore no-explicit-any
export type InteractionResponse = { type: number; data?: Record<string, any> };

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function message(data: Record<string, unknown>): InteractionResponse {
  return { type: ResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data };
}

export function ephemeral(content: string): InteractionResponse {
  return message({ content, flags: EPHEMERAL });
}

export function autocomplete(choices: { name: string; value: string }[]): InteractionResponse {
  return { type: ResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT, data: { choices } };
}

export function button(customId: string, label: string, style: number) {
  return { type: ComponentType.BUTTON, custom_id: customId, label, style };
}

export function actionRow(...components: unknown[]) {
  return { type: ComponentType.ACTION_ROW, components };
}

export function answerModal(interactionId: string): InteractionResponse {
  return {
    type: ResponseType.MODAL,
    data: {
      title: "Quid est responsum tuum?",
      custom_id: `response_input_${interactionId}`,
      components: [
        actionRow({
          type: ComponentType.TEXT_INPUT,
          custom_id: `response_input_${interactionId}`,
          style: 1,
          label: "Macrons are optional.",
          placeholder: "e.g., Grumio est mendax.",
          required: true,
          max_length: 400,
        }),
      ],
    },
  };
}
