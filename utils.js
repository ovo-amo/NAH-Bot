import 'npm:dotenv/config';
import { verifyKey } from 'npm:discord-interactions';

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const uFuzzy = require('@leeoniya/ufuzzy');
let uf = new uFuzzy();

export function equivalent(answers, given) {
  if (given in answers) {
    return true;
  }

  try {
    if (uf.search(answers, given, 1)[0].length > 0) {
      return true;
    }
    
    let splitted = given.split(" ");

    for (let i = 1; i < splitted.length; i++) {
      if (uf.search(answers, splitted.slice(0, i).join(" ") + " " + splitted.slice(i+1), 1)[0].length > 0) {
        return true;
      }
    }

    return false;
  } catch (error) {
    return false;
  }
  return false;
}

export function VerifyDiscordRequest(clientKey) {
  return function (req, res, buf, encoding) {
    const signature = req.get('X-Signature-Ed25519');
    const timestamp = req.get('X-Signature-Timestamp');

    const isValidRequest = verifyKey(buf, signature, timestamp, clientKey);
    if (!isValidRequest) {
      res.status(401).send('Bad request signature');
    }
  };
}

export async function DiscordRequest(endpoint, options) {
  const url = 'https://discord.com/api/v10/' + endpoint;

  if (options.body) options.body = JSON.stringify(options.body);

  const res = await fetch(url, {
    headers: {
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'User-Agent': 'DiscordBot (https://glitch.com/edit/#!/certamen-bot, 1.0.0)',
    },
    ...options
  });

  if (!res.ok) {
    const data = await res.json();
    console.log(res.status);
    throw new Error(JSON.stringify(data));
  }

  return res;
}

export async function InstallGlobalCommands(appId, commands) {
  const endpoint = `applications/${appId}/commands`;

  try {
    await DiscordRequest(endpoint, { method: 'PUT', body: commands });
  } catch (err) {
    console.error(err);
  }
}

const numerals = {
  M: 1000,
  CM: 900,
  D: 500,
  CD: 400,
  C: 100,
  XC: 90,
  L: 50,
  XL: 40,
  X: 10,
  IX: 9,
  V: 5,
  IV: 4,
  I: 1
};

export function Roman(n) {
  let str = '';

  for (let i of Object.keys(numerals)) {
    let q = Math.floor(n / numerals[i]);
    n -= q * numerals[i];
    str += i.repeat(q);
  }
  
  if (str == '') {
    return 'N';
  }

  return str;
}
