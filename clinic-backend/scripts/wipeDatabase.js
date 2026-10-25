const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const db = require('../src/config/db');

const CHILD_TABLES = [
  'patient_records',
  'bill_items',
  'payment_transactions',
  'appointments',
  'bills',
  'operating_hours',
  'admin_audit_logs',
  'clinic_owners',
  'doctors',
  'receptionists',
  'patients',
  'clinics',
];

async function existingTables(client, names) {
  const { rows } = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1)`,
    [names]
  );
  return rows.map((r) => r.tablename);
}

async function resolveSuperAdmin(client) {
  const email = (process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
  if (email) {
    const { rows } = await client.query(
      `SELECT id, email, role FROM users WHERE LOWER(email) = $1`,
      [email]
    );
    if (rows[0]) return { ...rows[0], via: 'SUPER_ADMIN_EMAIL' };
  }
  const { rows } = await client.query(
    `SELECT id, email, role FROM users
     WHERE role = 'admin' AND is_active = true
     ORDER BY id LIMIT 1`
  );
  if (rows[0]) return { ...rows[0], via: 'lowest-id active admin fallback' };
  return null;
}

async function countRows(client, tables) {
  const counts = {};
  for (const table of tables) {
    const { rows } = await client.query(`SELECT COUNT(*)::int AS n FROM ${table}`);
    counts[table] = rows[0].n;
  }
  return counts;
}

function printCounts(title, counts) {
  console.log(title);
  for (const [table, n] of Object.entries(counts)) {
    console.log(`  ${table}: ${n}`);
  }
}

async function main() {
  const confirm = process.argv.includes('--confirm');
  const client = await db.connect();
  try {
    const tables = await existingTables(client, [...CHILD_TABLES, 'users']);
    const missing = CHILD_TABLES.filter((t) => !tables.includes(t));
    if (missing.length) {
      console.warn(`Warning: tables not found, skipping: ${missing.join(', ')}`);
    }
    const targets = CHILD_TABLES.filter((t) => tables.includes(t));

    const admin = await resolveSuperAdmin(client);
    if (!admin) {
      console.error('Abort: no super admin found (no SUPER_ADMIN_EMAIL match, no active admin). Nothing wiped.');
      process.exitCode = 1;
      return;
    }
    console.log(`Super admin to keep: #${admin.id} ${admin.email} (${admin.role}) [${admin.via}]`);

    const before = await countRows(client, tables);
    printCounts('Row counts before:', before);

    if (!confirm) {
      console.log(`Dry run: would TRUNCATE [${targets.join(', ')}] RESTART IDENTITY, then DELETE FROM users WHERE id <> ${admin.id}, then resync the users id sequence. Re-run with --confirm to execute.`);
      return;
    }

    await client.query('BEGIN');
    try {
      if (targets.length) {
        await client.query(`TRUNCATE ${targets.join(', ')} RESTART IDENTITY`);
      }
      await client.query(`DELETE FROM users WHERE id <> $1`, [admin.id]);
      const seq = await client.query(`SELECT pg_get_serial_sequence('users', 'id') AS name`);
      if (seq.rows[0].name) {
        await client.query(
          `SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1))`
        );
        console.log('users id sequence resynced after kept admin.');
      } else {
        console.warn('Warning: no serial sequence found for users(id); sequence left untouched.');
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    const after = await countRows(client, tables);
    printCounts('Row counts after:', after);
    console.log('Wipe complete. Schemas untouched; super admin preserved.');
  } finally {
    client.release();
    await db.end();
  }
}

main().catch((error) => {
  console.error('Wipe failed:', error.message);
  process.exit(1);
});
