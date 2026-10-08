const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const db = require('../src/config/db');
const { hashPassword } = require('../src/utils/password');

const [email, password] = process.argv.slice(2);

const main = async () => {
  if (!email || !password) {
    console.error('Usage: node scripts/createAdmin.js <email> <password>');
    process.exit(1);
  }

  const result = await db.query(
    `INSERT INTO users (email, password_hash, role, is_active)
     VALUES ($1, $2, 'admin', true)
     ON CONFLICT (email)
     DO UPDATE SET password_hash = EXCLUDED.password_hash,
                   role = 'admin',
                   is_active = true
     RETURNING id, email, role, is_active;`,
    [email, hashPassword(password)]
  );

  console.log('Admin account ready:', result.rows[0]);
};

main()
  .then(() => db.end())
  .catch((error) => {
    console.error('Failed to create admin:', error.message);
    db.end();
    process.exit(1);
  });
