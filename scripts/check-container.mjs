import { randomBytes, randomUUID } from 'node:crypto';

if (process.env.CONTAINER_SMOKE_TEST !== 'yes')
  throw new Error(
    'Run only against a fresh disposable Compose stack with CONTAINER_SMOKE_TEST=yes.',
  );
const origin = process.env.APP_ORIGIN ?? 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname))
  throw new Error('Container smoke checks must target localhost.');
let cookie = '';
async function request(path, body, key = randomUUID()) {
  const response = await fetch(new URL(path, origin), {
    method: body ? 'POST' : 'GET',
    headers: {
      Origin: origin,
      Cookie: cookie,
      'Content-Type': 'application/json',
      'Idempotency-Key': key,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  return response;
}
const response = await request('/api/auth', {
  action: 'register',
  email: 'container-smoke@test.invalid',
  password: randomBytes(24).toString('hex'),
  name: 'Container smoke test',
  setupToken: process.env.SETUP_TOKEN,
});
cookie = response.headers.get('set-cookie')?.split(';')[0] ?? '';
if (!cookie) throw new Error('Registration did not set a session cookie.');
const account = await (
  await request('/api/records', {
    kind: 'account',
    name: 'Container bank',
    type: 'BANK',
    balance: 1000000,
    spendable: true,
  })
).json();
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const key = randomUUID();
const expense = {
  kind: 'expense',
  accountId: account.id,
  amount: 200000,
  date,
  category: 'Groceries',
  method: 'UPI',
  essentiality: 'MUST HAVE',
  description: 'Container encryption verification',
};
await request('/api/records', expense, key);
await request('/api/records', expense, key);
const snapshot = await (await request('/api/snapshot')).json();
if (
  snapshot.data.accounts.find((a) => a.id === account.id)?.balance !== 800000 ||
  snapshot.data.expenses.length !== 1
)
  throw new Error('Container accounting or duplicate-request protection failed.');
if (snapshot.data.expenses[0].description !== expense.description)
  throw new Error('Container encryption round trip failed.');
const badOrigin = await fetch(new URL('/api/records', origin), {
  method: 'POST',
  headers: {
    Origin: 'https://invalid.example',
    Cookie: cookie,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(expense),
});
if (badOrigin.ok) throw new Error('Foreign-origin mutation was accepted.');
await request('/api/auth', { action: 'logout' });
if ((await fetch(new URL('/api/snapshot', origin), { headers: { Cookie: cookie } })).status !== 401)
  throw new Error('Logout did not revoke the session.');
console.log(
  'Container smoke checks passed: registration, authenticated API, persistence, encryption, idempotency, origin validation, logout.',
);
