import EmbeddedPostgres from 'embedded-postgres';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { parse } from 'dotenv';
async function main() {
  const envPath = resolve('.env.test.local');
  if (!existsSync(envPath)) {
    const password = randomBytes(24).toString('hex');
    writeFileSync(
      envPath,
      `DATABASE_URL=postgresql://moneypath_test:${password}@127.0.0.1:55432/moneypath_test_utf8\nENCRYPTION_KEY=${randomBytes(32).toString('hex')}\nSETUP_TOKEN=${randomBytes(32).toString('hex')}\nAPP_ORIGIN=http://localhost:3100\nALLOW_INSECURE_COOKIE=true\n`,
    );
  }
  const env = parse(readFileSync(envPath));
  const url = new URL(env.DATABASE_URL);
  if (
    url.hostname !== '127.0.0.1' ||
    url.port !== '55432' ||
    url.pathname !== '/moneypath_test_utf8'
  )
    throw new Error('Test database must be isolated at 127.0.0.1:55432/moneypath_test_utf8');
  const databaseDir = resolve('.local-db');
  const pg = new EmbeddedPostgres({
    databaseDir,
    user: url.username,
    password: url.password,
    port: 55432,
    persistent: true,
    authMethod: 'scram-sha-256',
    initdbFlags: ['--encoding=UTF8'],
    postgresFlags: ['-h', '127.0.0.1'],
    onLog: () => {},
    onError: () => {},
  });
  if (!existsSync(resolve(databaseDir, 'PG_VERSION'))) await pg.initialise();
  await pg.start();
  const client = pg.getPgClient();
  await client.connect();
  const result = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = 'moneypath_test_utf8'",
  );
  if (!result.rowCount)
    await client.query("CREATE DATABASE moneypath_test_utf8 TEMPLATE template0 ENCODING 'UTF8'");
  await client.end();
  console.log(
    'Isolated PostgreSQL test database ready on 127.0.0.1:55432. Credentials are in .env.test.local.',
  );
  const keepAlive = setInterval(() => {}, 1000);
  const stop = async () => {
    clearInterval(keepAlive);
    await pg.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
