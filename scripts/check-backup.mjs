import { parse } from 'dotenv';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { encrypt, decrypt } from '../src/lib/security.ts';

// Never fall back to a real DATABASE_URL inherited from the caller.
const config = parse(readFileSync(resolve('.env.test.local')));
const url = new URL(config.DATABASE_URL);
if (url.hostname !== '127.0.0.1' || url.port !== '55432' || url.pathname !== '/moneypath_test_utf8')
  throw new Error('Refusing non-test database');
process.env.ENCRYPTION_KEY = config.ENCRYPTION_KEY;
const bin = process.env.PG_BIN_DIR;
const executable = (exe) =>
  bin ? resolve(bin, exe + (process.platform === 'win32' ? '.exe' : '')) : exe;
const env = {
  ...process.env,
  PGPASSWORD: decodeURIComponent(url.password),
  PGHOST: url.hostname,
  PGPORT: url.port,
  PGUSER: decodeURIComponent(url.username),
  PGOPTIONS: '-c timezone=UTC',
};
function run(exe, args) {
  if (bin && !existsSync(executable(exe))) throw new Error(`PG_BIN_DIR is missing ${exe}.`);
  const result = spawnSync(executable(exe), args, {
    env,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
  });
  if (result.status !== 0)
    throw new Error(
      result.stderr || `Install PostgreSQL client tools (${exe}) and set PG_BIN_DIR.`,
    );
  return result.stdout.trim();
}
const versions = { dump: run('pg_dump', ['--version']), restore: run('pg_restore', ['--version']) };
mkdirSync(resolve('backups'), { recursive: true });
mkdirSync(resolve('artifacts'), { recursive: true });
const suffix = Date.now() + '_' + randomUUID().slice(0, 8);
const dump = resolve('backups', `test-verification-${suffix}.dump`);
const restoredName = 'moneypath_restore_test_' + suffix;
const fixtureId = 'backup-fixture-' + suffix;
const source = new pg.Client({ connectionString: url.toString() });
let restored;
let fixtureCommitted = false;
const quote = (name) => '"' + name.replaceAll('"', '""') + '"';
async function fingerprint(client) {
  const tables = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
  );
  const result = {};
  for (const { tablename } of tables.rows) {
    const rows = await client.query(
      `SELECT count(*)::int AS count, md5(COALESCE(string_agg(to_jsonb(t)::text, E'\\n' ORDER BY to_jsonb(t)::text), '')) AS digest FROM public.${quote(tablename)} t`,
    );
    result[tablename] = rows.rows[0];
  }
  return result;
}
async function checkEncryptedFields(client) {
  let checked = 0;
  for (const [table, column] of [
    ['Card', 'lastFour'],
    ['Expense', 'description'],
    ['Income', 'notes'],
    ['Payment', 'notes'],
    ['PersonalEntry', 'reference'],
    ['PersonalEntry', 'notes'],
    ['PersonalSettlement', 'notes'],
    ['PersonalAdvance', 'notes'],
    ['Investment', 'notes'],
    ['InvestmentEvent', 'notes'],
    ['Goal', 'notes'],
    ['PushSubscription', 'payload'],
    ['ChatMessage', 'content'],
    ['CashAdvance', 'notes'],
    ['Card', 'notes'],
    ['Audit', 'interpretation'],
  ]) {
    const rows = await client.query(
      `SELECT ${quote(column)} AS value FROM ${quote(table)} WHERE ${quote(column)} IS NOT NULL`,
    );
    for (const { value } of rows.rows) {
      decrypt(value);
      checked++;
    }
  }
  if (!checked) throw new Error('No encrypted values were exercised by the restore check.');
  return checked;
}
try {
  await source.connect();
  await source.query("SET TIME ZONE 'UTC'");
  // Synthetic records ensure monetary and encryption checks even on an empty test database.
  await source.query('BEGIN');
  await source.query(
    'INSERT INTO "User" (id,"ownerKey",email,password,name) VALUES ($1,$1,$2,$3,$4)',
    [fixtureId, fixtureId + '@test.invalid', 'unused-test-password', 'Backup verification fixture'],
  );
  await source.query(
    'INSERT INTO "Account" (id,"userId",name,kind,balance) VALUES ($1,$2,$3,$4,$5)',
    [fixtureId + '-account', fixtureId, 'Backup test account', 'BANK', 1234567],
  );
  await source.query(
    'INSERT INTO "Income" (id,"userId","accountId",amount,date,source,status,notes) VALUES ($1,$2,$3,$4,CURRENT_DATE,$5,$6,$7)',
    [
      fixtureId + '-income',
      fixtureId,
      fixtureId + '-account',
      10000,
      'Other Income',
      'RECEIVED',
      encrypt('Restore check: ₹100.00 — confidential sample'),
    ],
  );
  await source.query('COMMIT');
  fixtureCommitted = true;
  await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const {
    rows: [snapshot],
  } = await source.query('SELECT pg_export_snapshot() AS id');
  const before = await fingerprint(source);
  const encryptedBefore = await checkEncryptedFields(source);
  run('pg_dump', ['-d', 'moneypath_test_utf8', '--snapshot', snapshot.id, '-Fc', '-f', dump]);
  await source.query('COMMIT');
  await source.query(`CREATE DATABASE ${quote(restoredName)} TEMPLATE template0 ENCODING 'UTF8'`);
  run('pg_restore', ['-d', restoredName, '--no-owner', '--exit-on-error', dump]);
  const restoredUrl = new URL(url);
  restoredUrl.pathname = '/' + restoredName;
  restored = new pg.Client({ connectionString: restoredUrl.toString() });
  await restored.connect();
  await restored.query("SET TIME ZONE 'UTC'");
  const after = await fingerprint(restored);
  if (JSON.stringify(before) !== JSON.stringify(after))
    throw new Error('Restored table data differs from the exported snapshot.');
  const encryptedAfter = await checkEncryptedFields(restored);
  if (encryptedAfter !== encryptedBefore) throw new Error('Encrypted field counts differ.');
  const fixture = await restored.query('SELECT balance FROM "Account" WHERE id=$1', [
    fixtureId + '-account',
  ]);
  if (fixture.rows[0]?.balance !== 1234567) throw new Error('Restored monetary amount differs.');
  await restored.query('BEGIN');
  let constraintRejected = false;
  try {
    await restored.query('UPDATE "Account" SET balance=-1 WHERE id=$1', [fixtureId + '-account']);
  } catch (error) {
    if (error.code !== '23514') throw error;
    constraintRejected = true;
  } finally {
    await restored.query('ROLLBACK');
  }
  if (!constraintRejected)
    throw new Error('Restored balance constraint did not reject a negative amount.');
  const report = {
    verifiedAt: new Date().toISOString(),
    versions,
    tables: before,
    encryptedFieldsChecked: encryptedAfter,
    monetaryFixtureVerified: true,
    balanceConstraintVerified: true,
    dump,
    restoredDatabase: restoredName,
  };
  writeFileSync(
    resolve('artifacts/backup-verification.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    `Backup/restore passed: ${Object.keys(before).length} tables matched, ${encryptedAfter} encrypted fields decrypted, monetary balance and database constraint verified.`,
  );
  console.log('Report: artifacts/backup-verification.json. Restored test database retained.');
} finally {
  try {
    await source.query('ROLLBACK').catch(() => {});
    if (fixtureCommitted) {
      await source.query('BEGIN');
      try {
        await source.query('DELETE FROM "Income" WHERE id=$1 AND "userId"=$2', [
          fixtureId + '-income',
          fixtureId,
        ]);
        await source.query('DELETE FROM "Account" WHERE id=$1 AND "userId"=$2', [
          fixtureId + '-account',
          fixtureId,
        ]);
        await source.query('DELETE FROM "User" WHERE id=$1 AND "ownerKey"=$1', [fixtureId]);
        await source.query('COMMIT');
      } catch (error) {
        await source.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await source.end().catch(() => {});
    if (restored) await restored.end().catch(() => {});
  }
}
