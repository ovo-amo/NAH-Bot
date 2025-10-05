import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const fs = require("fs");

fs.writeFile("./db.json", `{"leaderboard":{},"active":{"interactions":{},"questions":{}}}`, () => {});