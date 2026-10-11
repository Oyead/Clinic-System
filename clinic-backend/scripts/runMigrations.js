const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const db = require('../src/config/db');

const migrationsDir = path.join(__dirname, 'migrations');
const files = fs
  .readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort();

(async () => {
  for (const file of files) {
    const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const statements = content
      .split(/;\s*\n/)
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await db.query(statement);
    }
    console.log(`Applied ${file}`);
  }
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
