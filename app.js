import 'dotenv/config';
import express from 'express';
import {
  InteractionType,
  InteractionResponseType,
  InteractionResponseFlags,
  MessageComponentTypes,
  ButtonStyleTypes,
  verifyKeyMiddleware
} from 'discord-interactions';

import { VerifyDiscordRequest, DiscordRequest, Roman } from './utils.js';
import { returnQuestion, donateQuestion, answer, HELP } from './certamen.js';
import { db, save, stats, leaderboard_update } from './db.js';
import { REVERSE } from './questions.js';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const bodyParser = require('body-parser');
const jsonParser = bodyParser.json();

const PUBLIC_KEY = process.env.PUBLIC_KEY;

const app = express();
const PORT = process.env.PORT || 3000;

let DiscordisMean = 3;

app.post('/interactions', jsonParser, async function (req, res) {
  if (DiscordisMean == 1) {
    DiscordisMean++;
    return res.status(401).end("invalid request signature");
  } else if (DiscordisMean == 2) {
    DiscordisMean++;
    return res.send({ type: InteractionResponseType.PONG });
  }

  const { type, id, data } = req.body;

  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    if (name === 'quaestio') {
      const genusID = data.options[0].value;
      return res.send(await returnQuestion(genusID, id, req.body.member.user.id));
    }

    if (name === 'donas') {
      const numQuestions = data.options[0].value;
      const recipientID = data.options[1].value;
      const genusID = data.options[2].value;

      return res.send(await donateQuestion(genusID, id, req.body.member.user.id, recipientID, numQuestions));
    }

    if (name === 'status') {
      const { correct, incorrect } = stats(req.body.channel.guild_id, data.options[0].value)
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [{
            title: 'Status Histrionis',
            description: `Hi sunt stati.`,
            fields: [{
              name: "Correctus",
              value: Roman(correct),
              inline: true
            }, {
              name: "Incorrectus",
              value: Roman(incorrect),
              inline: true
            }]
          }]
        }
      });
    }

    if (name === 'ductustabula') {
      const guild = req.body.channel.guild_id;
      const data = db.leaderboard[guild];
      
      let players = Object.keys(data).map(player => {
        let { correct, incorrect } = stats(guild, player);
        return {
          correct: Roman(correct),
          incorrect: Roman(incorrect),
          score: correct - incorrect,
          playerID: player
        }
      });
      players.sort((a, b) => b.score - a.score);
      
      
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [{
            title: 'Stati Histrionum',
            description: players.map((player, index) => `${index+1}. <@${player.playerID}> (correctus: ${player.correct}, incorrectus: ${player.incorrect})`).join("\n")
          }]
        }
      });
    }

    if (name === 'auxilia') {
      const guild = req.body.channel.guild_id;
      const data = db.leaderboard[guild];
      
      return res.send(HELP);
    }

    if (name === 'deficis') {
      const questionID = data.options[0].value;
      
      if (questionID in db.active.questions) {
        let { interactionID, answers, genus } = db.active.questions[questionID];
        
        delete db.active.interactions[interactionID];
        delete db.active.questions[questionID];
        
        const player = req.body.member.user.id;
        const guild = req.body.channel.guild_id;
        
        const {correct, incorrect} = leaderboard_update(guild, player, false);

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [{
              title: 'Certamen Quaestionem Defectus',
              description: `Eheu! Responsum in systemate est *${answers.join("; ")}*.`,
              fields: [{
                name: "Qui defeci?",
                value: `<@${req.body.member.user.id}>`,
                inline: true
              }, {
                name: "Correctus",
                value: Roman(correct),
                inline: true
              }, {
                name: "Incorrectus",
                value: Roman(incorrect),
                inline: true
              }], 
              footer: {
                text: `Question ID: ${questionID}`
              }
            }],
            components: [
              {
                type: MessageComponentTypes.ACTION_ROW,
                components: [
                  {
                    type: MessageComponentTypes.BUTTON,
                    custom_id: `new_question_button_${genus}`,
                    label: 'Novum',
                    style: ButtonStyleTypes.SECONDARY
                  }
                ]
              }
            ]
          }
        });
      } else {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: 'Hic identitas vera non est.',
            flags: 1 << 6
          }
        });
      }
    }

    if (name === 'respondes') {
      const questionID = data.options[0].value;
      
      if (questionID in db.active.questions) {
        const interactionID = db.active.questions[questionID].interactionID;

        return res.send({
          type: InteractionResponseType.MODAL,
          data: {
            title: 'Quid est responsum tuum?',
            custom_id: `response_input_${interactionID}`,
            components: [{
              type: 1,
              components: [{
                type: 4,
                custom_id: `response_input_${interactionID}`,
                style: 1,
                label: "Do not include macrons.",
                placeholder: "e.g., Grumio est mendax."
              }]
            }]
          }
        });
      } else {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: 'Hic identitas vera non est.',
            flags: 1 << 6
          }
        });
      }
    }
  } else if (type === InteractionType.MESSAGE_COMPONENT) {
    const { custom_id } = data;

    if (custom_id.startsWith('new_question_button_')) {
      const genusID = REVERSE[custom_id.replace('new_question_button_', '')];
      return res.send(await returnQuestion(genusID, id, req.body.member.user.id));
    } else if (custom_id.startsWith('respond_to_question_button_')) {
      const interactionID = custom_id.replace('respond_to_question_button_', '');

      return res.send({
        type: InteractionResponseType.MODAL,
        data: {
          title: 'Quid est responsum tuum?',
          custom_id: `response_input_${interactionID}`,
          components: [{
            type: 1,
            components: [{
              type: 4,
              custom_id: `response_input_${interactionID}`,
              style: 1,
              label: "Do not include macrons.",
              placeholder: "e.g., Grumio est mendax."
            }]
          }]
        }
      });
    }
  } else if (type === InteractionType.MODAL_SUBMIT) {
    const { custom_id } = data;

    if (custom_id.startsWith('response_input_')) {
      const interactionID = custom_id.replace('response_input_', '');
      
      const guild = req.body.channel.guild_id;
      const player = req.body.member.user.id;

      const response = data.components[0].components[0].value;
      
      return res.send(answer(interactionID, guild, player, response));
    }
  }
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});