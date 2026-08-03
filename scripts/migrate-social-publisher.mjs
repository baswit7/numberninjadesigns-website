import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

const databaseUrl = String(process.env.DATABASE_URL ?? '').trim();
if (!databaseUrl) throw new Error('DATABASE_URL ontbreekt.');
const migrationPath = fileURLToPath(new URL('../server/social-publisher/migration.sql', import.meta.url));
const migration = await readFile(migrationPath, 'utf8');
const sql = neon(databaseUrl);
const statements = migration
  .split(';')
  .map((statement) => statement.trim())
  .filter((statement) => statement && !['BEGIN', 'COMMIT'].includes(statement.toUpperCase()));
for (const statement of statements) await sql.query(statement, []);
const rows = await sql.query(`
  SELECT COUNT(*)::integer AS table_count
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name LIKE 'publisher_%'
`, []);
if (Number(rows[0]?.table_count) !== 9) throw new Error('De publisher-migratie kon niet volledig worden teruggelezen.');
console.log(JSON.stringify({ ok: true, tableCount: Number(rows[0].table_count) }));
