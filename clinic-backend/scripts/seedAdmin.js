// Idempotent bootstrap seed: creates the Super Admin from secure .env
// credentials, but ONLY when zero admins exist in the database.
//
// Usage:
//   npm run seed:admin
//   npm run seed:admin -- admin@example.com 'StrongPassword123'
//   node scripts/seedAdmin.js [email] [password]
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const db = require('../src/config/db');
const { ensureSuperAdmin } = require('../src/utils/bootstrapAdmin');

const [cliEmail, cliPassword] = process.argv.slice(2);

const main = async () => {
  const result = await ensureSuperAdmin({
    ...(cliEmail ? { email: cliEmail } : {}),
    ...(cliPassword ? { password: cliPassword } : {}),
  });

  if (result.created) {
    console.log('Seed complete: Super Admin created:', {
      id: result.user.id,
      email: result.user.email,
      role: result.user.role,
    });
  } else if (result.reason === 'admin-exists') {
    console.log(`Seed skipped: ${result.adminCount} active admin(s) already exist. No changes made.`);
  } else {
    console.log('Seed skipped: admin already exists (concurrent seed).');
  }
};

main()
  .then(() => db.end())
  .catch((error) => {
    console.error('Seed failed:', error.message);
    db.end();
    process.exit(1);
  });
