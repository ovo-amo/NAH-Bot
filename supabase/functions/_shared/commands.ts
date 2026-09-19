// Slash-command definitions. Registered with Discord by
// `scripts/register-commands.ts` (run automatically by the deploy workflow).
// Command and option names are what players type, so changing them changes
// the user experience; descriptions are only shown in Discord's picker.

import { GENERA } from "./genera.ts";

// Discord option types: 3 = string, 4 = integer, 6 = user.
const GENUS_CHOICES = GENERA.map((g) => ({ name: g.name, value: g.code }));

export const COMMANDS = [
  {
    name: "quaestio",
    description: "Quaestionem Certamenis volo.",
    type: 1,
    options: [
      {
        name: "genus",
        description: "Quid genus tibi dabo?",
        type: 3,
        required: true,
        choices: GENUS_CHOICES,
      },
    ],
  },
  {
    name: "respondes",
    description: "Invenisti responsum quaestioni meae.",
    type: 1,
    options: [
      {
        name: "identitas",
        description: "Pick the question to answer (start typing its ID or text).",
        type: 3,
        required: true,
        autocomplete: true,
      },
    ],
  },
  {
    name: "deficis",
    description: "Tu deficis quod aliquam ideam non habes.",
    type: 1,
    options: [
      {
        name: "identitas",
        description: "Pick the question to give up on (start typing its ID or text).",
        type: 3,
        required: true,
        autocomplete: true,
      },
    ],
  },
  {
    name: "donas",
    description: "Das quaestiones.",
    type: 1,
    options: [
      {
        name: "numerus",
        description: "Quot quaestiones vis dare?",
        type: 4,
        required: true,
        min_value: 1,
        max_value: 10,
      },
      {
        name: "receptor",
        description: "Quaeri quis vis?",
        type: 6,
        required: true,
      },
      {
        name: "genus",
        description: "Quid genera?",
        type: 3,
        required: true,
        choices: GENUS_CHOICES,
      },
    ],
  },
  {
    name: "status",
    description: "Statum videre vis.",
    type: 1,
    options: [
      {
        name: "histrio",
        description: "Cuius statum videre vis?",
        type: 6,
        required: true,
      },
    ],
  },
  {
    name: "ductustabula",
    description: "(View leaderboard.)",
    type: 1,
  },
  {
    name: "auxilia",
    description: "(Help.)",
    type: 1,
  },
];
