import {
  InteractionResponseType,
  MessageComponentTypes,
  ButtonStyleTypes,
} from 'npm:discord-interactions';

import { db, save, leaderboard_update } from './db.js';
import { Roman, equivalent } from './utils.js';
import { random, GENI, LATINS, find } from './questions.js';

export async function returnQuestion(ID, interactionID, player) {
  const { question, questionID, answers, genus } = await random(ID);

  db.active.interactions[interactionID] = {
    questionID,
    answers,
    genus,
    question
  };

  db.active.questions[questionID] = {
    interactionID,
    answers,
    genus,
    question
  };

  save();

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [{
        title: "Certamen Quaestionem",
        description: `${question}\n\nRespond either through \`/respondes\` or the button below (or give up with \`/deficis\` to view the answer).`,
        fields: [{
          name: "Qui postulavit?",
          value: `<@${player}>`,
          inline: true
        }, {
          name: "Genus",
          value: LATINS[genus],
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
              custom_id: `respond_to_question_button_${interactionID}`,
              label: 'Respondes',
              style: ButtonStyleTypes.PRIMARY
            }, {
              type: MessageComponentTypes.BUTTON,
              custom_id: `new_question_button_${genus}`,
              label: 'Novum',
              style: ButtonStyleTypes.SECONDARY
            }
          ]
        }
      ]
    }
  };
}

export async function donateQuestion(ID, interactionID, donorID, recipientID, numQuestions) {
  let questions = [];
  let chosenIDs = [];
  
  for (let i = 0; i < numQuestions; i++) {
    let { question, questionID, answers, genus } = await random(ID);
    
    if (chosenIDs.includes(questionID)) {
      let new_data = await find(ID, GENI[ID].number);

      question = new_data.question;
      questionID = new_data.questionID;
      answers = new_data.answers;
      genus = new_data.genus;
    }

    db.active.interactions[interactionID + "_" + i] = {
      questionID,
      answers,
      genus,
      question
    };

    db.active.questions[questionID] = {
      interactionID: interactionID + "_" + i,
      answers,
      genus,
      question
    };
    
    questions.push({
      question,
      questionID,
      genus
    });
    
    chosenIDs.push(questionID);
  }

  save();

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [{
        title: "Donum Certaminis Quaestionum",
        description: `<@${donorID}> donated **${Roman(numQuestions)}** questions to <@${recipientID}>!\n\n` + questions.map((e, i) => `${i+1}. ${e.question}`).join("\n"),
        fields: [{
          name: "Genus",
          value: LATINS[GENI[ID].genus],
          inline: true
        }, {
          name: "Respondere",
          value: "Use `/respondes`.",
          inline: true
        }], 
        footer: {
          text: `Question ID${questions.length == 1 ? '' : '(s)'}: ${questions.map((e, i) => `${questions.length == 1 ? '' : (i+1) + "—"}${e.questionID}`).join("; ")}`
        }
      }]
    }
  };
}

export function answer(interactionID, guild, player, response) {
  const { questionID, answers, genus } = db.active.interactions[interactionID];
  const verdict = equivalent(answers, response);

  const {correct, incorrect} = leaderboard_update(guild, player, verdict);

  delete db.active.interactions[interactionID];
  delete db.active.questions[questionID];

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [{
        title: 'Certamen Quaestionem',
        description: `Responsum tuum (*${response}*) est... **${verdict ? 'bonum' : 'malum'}**. Responsum in systemate est *${answers.join("; ")}*.`,
        fields: [{
          name: "Qui postulavit?",
          value: `<@${player}>`,
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
  };
}

export const HELP = {
  type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
  data: {
    embeds: [{
      title: 'Auxilium',
      description: "Need help studying for Certamen, but don't want to make a Quizlet? This is for you. Below are a list of the question genres available.\n\nUse `/quaestio` for most purposes, `/ductustabula` to show a leaderboard, `/donas` to *donate* questions to a friend, etc. Please contact `timothyc.` with questions.",
      fields: Object.values(GENI).map(genus => ({
        name: genus.name,
        value: genus.example,
        inline: true
      }))
    }, {
      title: 'Pro Latin Is',
      description: "Are you a Latin I? Try starting with `Inflectis pro Latinos Quintos` (`Grammatica` is pretty misleading and kind of boring + advanced, so don't do that one if you're looking to practice your grammar). Or, if for some crazy reason grammar isn't your thing, try\n\n‣ `Historia` (history),\n‣ `Fabula` (myth),\n‣ `PMAQ` (phrases, mottoes, abbreviations, and quotations),\n‣ `Cultura et Vita Cotidiana` (culture and daily life),\n‣ `Derivativus Graecus` (Greek derivatives),\n‣ or `Derivativus` (normal derivatives).\n\nThe other categories are for later and you don't need to study those, for now."
    }]
  }
};
