import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const fs = require("fs");

console.log(fs.readFileSync('./db.json', 'utf8'));