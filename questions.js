import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const fs = require('fs');
const readline = require('readline');

export const GENI = {
  "G": {
    "genus": "grammar",
    "name": "Grammatica",
    "example": "Find the proper form of the incorrect word in `Grumio in culinam cenam non parat.`",
    "number": 3000
  },
  "H": {
    "genus": "history",
    "name": "Historia",
    "example": "Who was emperor during the most famous volcanic eruption where Grumio lived?",
    "number": 1309
  },
  "F": {
    "genus": "myth",
    "name": "Fabula",
    "example": "Although Grumio could never have cooked it, what is the food of the gods?",
    "number": 2357
  },
  "L": {
    "genus": "literature",
    "name": "Littera",
    "example": "What Latin cookbook has the same name as its author?",
    "number": 798
  },
  "C": {
    "genus": "culture_daily_life",
    "name": "Cultura et Vita Cotidiana",
    "example": "If Grumio were cooking, what part of the house would he be in?",
    "number": 510
  },
  "P": {
    "genus": "pmaq",
    "name": "PMAQ",
    "example": "What is the Latin motto of Grumio's birthplace, the University of Cambridge?",
    "number": 255
  },
  "T": {
    "genus": "translation",
    "name": "Translatio",
    "example": "Translate `Grumio erat mendax, quod cenam optimam non parabat.`",
    "number": 2307
  },
  "I": {
    "genus": "inflection",
    "name": "Inflectis",
    "example": "Give the 2nd-person singular present active imperative of `cenam paro`.",
    "number": 119207
  },
  "D": {
    "genus": "derivative",
    "name": "Derivativus",
    "example": "Although Grumio could never have cooked it, what Latin root does `biscuit` have?",
    "number": 871
  },
  "A": {
    "genus": "greek_derivatives",
    "name": "Derivativus Graecus",
    "example": "What Greek root is most related to the word `bake`?",
    "number": 736
  },
  "LFIFTH": {
    "genus": "LFIFTH_inflection",
    "name": "Inflectis pro Latinos Quintos",
    "example": "Inflection for Latin 0.2s.",
    "number": 7256
  },
  "LHALF": {
    "genus": "LHALF_inflection",
    "name": "Inflectis pro Latina Dimidia",
    "example": "Inflection for Latin 0.5s.",
    "number": 12338
  },
  "L1": {
    "genus": "L1_inflection",
    "name": "Inflectis pro Latinos Unos",
    "example": "Inflection for Latin Is.",
    "number": 22096
  },
  "L2": {
    "genus": "L2_inflection",
    "name": "Inflectis pro Latinos Duos",
    "example": "Inflection for Latin IIs.",
    "number": 85423
  },
  "LADV": {
    "genus": "LADV_inflection",
    "name": "Inflectis pro Latinos Tres et Plures",
    "example": "Inflection for Latin ADVs (III+).",
    "number": 109837
  },
  "PW": {
    "genus": "pw",
    "name": "Πόλεμος τῶν Πελοποννησίων",
    "example": "Peloponnesian War.",
    "number": 151
  },
  "GMDR": {
    "genus": "gmdr",
    "name": "Greek Medical Roots",
    "example": "What Greek root gives *peptide*?",
    "number": 1229
  },
  "M": {
    "genus": "mixed",
    "name": "Mixtum",
    "example": "Mixed."
  }
};

export const REVERSE = Object.keys(GENI).reduce((obj, key) => {
  obj[GENI[key].genus] = key;
  return obj;
}, {});

export const LATINS = Object.keys(GENI).reduce((obj, key) => {
  obj[GENI[key].genus] = GENI[key].name;
  return obj;
}, {});

export async function find(ID, questionID) {
  let { genus } = GENI[ID];

  const fileStream = fs.createReadStream(`./questions/${genus}.csv`);

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.startsWith(questionID)) {
      let data = line.split(",");

      let question = data[1].replaceAll('`', '"').replaceAll('>', ',').replaceAll('\\n', '\n');
      let answers = data[2].replaceAll('`', '"').replaceAll('>', ',').replaceAll('\\n', '\n').split('; ');
      
      return {
        question,
        questionID,
        answers,
        genus
      };
    }
  }
}

const IDs = ["G","H","F","L","C","P","T","I","D","A","LFIFTH","LHALF","L1","L2","LADV","PW","GMDR"];

export function random(ID) {
  if (ID == "M") {
    const index = Math.floor(Math.random() * IDs.length);

    if (index == 9) {
      return find(ID, ID + Math.floor(Math.random() * GENI[ID].number).toString().padStart(6, 0));
    }
    
    return random(IDs[index]);
  } else {
    return find(ID, ID + Math.floor(Math.random() * GENI[ID].number).toString().padStart(6, 0));
  }
}