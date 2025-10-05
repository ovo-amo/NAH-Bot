import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const fs = require("fs");

let contents = fs.readFileSync('./db.json', 'utf8');

if (contents.length == "") {
  contents = `{"leaderboard":{},"active":{"interactions":{},"questions":{}}}`;
}

export const db = JSON.parse(contents);
if (!db.leaderboard) db.leaderboard = {};
if (!db.active) db.active = {
  questions: {},
  interactions: {}
};

export function save() {
  fs.writeFile("./db.json", JSON.stringify(db), () => {});
}

save();

export function leaderboard_update(guild, player, correct) {
  if (guild in db.leaderboard) {
    if (player in db.leaderboard[guild]) {
      db.leaderboard[guild][player][correct ? "correct" : "incorrect"] += 1;
    } else {
      db.leaderboard[guild][player] = {
        correct: 0,
        incorrect: 0
      }

      db.leaderboard[guild][player][correct ? "correct" : "incorrect"] += 1;
    }
  } else {
    db.leaderboard[guild] = {}

    db.leaderboard[guild][player] = {
      correct: 0,
      incorrect: 0
    }

    db.leaderboard[guild][player][correct ? "correct" : "incorrect"] += 1;
  }
  
  save();
  
  return stats(guild, player);
}

export function stats(guild, player) {
  if (guild in db.leaderboard) {
    if (player in db.leaderboard[guild]) {
      return db.leaderboard[guild][player];
    } else {
      db.leaderboard[guild][player] = {
        correct: 0,
        incorrect: 0
      }
      
      save();

      return {
        correct: 0,
        incorrect: 0
      }
    }
  } else {
    db.leaderboard[guild] = {
      player: {
        correct: 0,
        incorrect: 0
      }
    }
      
    save();

    return {
      correct: 0,
      incorrect: 0
    }
  }
}