import 'dotenv/config';
import { InstallGlobalCommands } from './utils.js';
import { GENI } from './questions.js';

// Command containing options
const QUESTION_COMMAND = {
  "name": "quaestio",
  "description": "Quaestionem Certamenis volo.",
  "options": [
    {
      "name": "genus",
      "description": "Quid genus tibi dabo?",
      "type": 3,
      "required": true,
      "choices": Object.keys(GENI).map(ID => ({name: GENI[ID].name, value: ID}))
    }
  ],
  "type": 1
};


const ANSWER_COMMAND = {
  "name": "respondes",
  "description": "Invenisti responsum quaestioni meae.",
  "options": [
    {
      "name": "identitas",
      "description": "Copy and paste the ID from the question you would like to answer.",
      "type": 3,
      "required": true
    }
  ],
  "type": 1
};

const GIVE_UP_COMMAND = {
  "name": "deficis",
  "description": "Tu deficis quod aliquam ideam non habes.",
  "options": [
    {
      "name": "identitas",
      "description": "Copy and paste the ID from the question you would like to give up on.",
      "type": 3,
      "required": true
    }
  ],
  "type": 1
};

const DONATE_COMMAND = {
  "name": "donas",
  "description": "Das quaestiones.",
  "options": [
    {
      "name": "numerus",
      "description": "Quot quaestiones vis dare?",
      "min_value": 1,
      "max_value": 10,
      "type": 4,
      "required": true
    }, {
      "name": "receptor",
      "description": "Quaeri quis vis?",
      "type": 6,
      "required": true
    }, {
      "name": "genus",
      "description": "Quid genera?",
      "type": 3,
      "required": true,
      "choices": Object.keys(GENI).map(ID => ({name: GENI[ID].name, value: ID}))
    }
  ],
  "type": 1
};

const STATUS_COMMAND = {
  "name": "status",
  "description": "Statum videre vis.",
  "options": [
    {
      "name": "histrio",
      "description": "Cuius statum videre vis?",
      "type": 6,
      "required": true
    }
  ],
  "type": 1
};

const LEADERBOARD_COMMAND = {
  "name": "ductustabula",
  "description": "(View leaderboard.)",
  "type": 1
};

const HELP_COMMAND = {
  "name": "auxilia",
  "description": "(Help.)",
  "type": 1
};

const ALL_COMMANDS = [QUESTION_COMMAND, ANSWER_COMMAND, GIVE_UP_COMMAND, DONATE_COMMAND, STATUS_COMMAND, LEADERBOARD_COMMAND, HELP_COMMAND];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);