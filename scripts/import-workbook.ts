import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { db } from '../src/lib/db';
import { execute, readData } from '../src/lib/service';
import { encrypt, tokenHash } from '../src/lib/security';
import type { Command } from '../src/lib/validation';

async function main() {
  if (process.env.CONFIRM_PERSONAL_IMPORT !== 'yes')
    throw new Error('Set CONFIRM_PERSONAL_IMPORT=yes for the reviewed one-owner import');
  const file = process.argv[2];
  if (!file) throw new Error('Pass the private import JSON path');
  const input = JSON.parse(readFileSync(file, 'utf8'));
  const users = await db.user.findMany({ select: { id: true } });
  if (users.length !== 1) throw new Error('Import requires exactly one registered owner');
  const userId = users[0].id;
  const requestId = (key: string) => {
    const hex = createHash('sha256').update(`workbook-v1:${key}`).digest('hex').slice(0, 32);
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
  };
  const run = (key: string, command: Command) =>
    execute(userId, requestId(key), command, { source: 'PORTAL', confirmedByUser: true });

  await run('settings', { kind: 'settings', ...input.settings });
  let data = await readData(userId);
  for (const item of input.accounts) {
    const existing = data.accounts.find(
      (row) => row.name.toLowerCase() === item.name.toLowerCase(),
    );
    await run(
      `account:${existing ? 'update' : 'create'}:${item.name}`,
      existing ? { kind: 'updateAccount', id: existing.id, ...item } : { kind: 'account', ...item },
    );
  }
  data = await readData(userId);
  const accountIds = Object.fromEntries(data.accounts.map((row) => [row.name, row.id]));
  for (const item of input.incomes) {
    if (
      data.incomes.some(
        (row) =>
          row.source === item.source &&
          row.date.slice(0, 10) === item.date &&
          row.amount === item.amount,
      )
    )
      continue;
    const row = await db.income.create({
      data: {
        userId,
        accountId: accountIds[item.account],
        amount: item.amount,
        date: new Date(`${item.date}T00:00:00.000Z`),
        source: item.source,
        recurring: item.recurring,
        status: 'RECEIVED',
        balanceApplied: false,
        notes: encrypt(item.notes),
      },
    });
    await db.audit.create({
      data: {
        userId,
        requestId: requestId(`income:${item.date}:${item.amount}`),
        requestHash: tokenHash(JSON.stringify(item)),
        action: 'snapshotIncome',
        entityId: row.id,
        source: 'PORTAL',
        confirmedByUser: true,
      },
    });
  }
  data = await readData(userId);
  for (const item of input.cards) {
    const existing = data.cards.find((row) => row.name.toLowerCase() === item.name.toLowerCase());
    await run(
      `card:${existing ? 'update' : 'create'}:${item.name}`,
      existing ? { kind: 'updateCard', id: existing.id, ...item } : { kind: 'card', ...item },
    );
  }
  data = await readData(userId);
  for (const item of input.commitments) {
    const existing = data.commitments.find(
      (row) => row.name.toLowerCase() === item.name.toLowerCase(),
    );
    await run(
      `commitment:${existing ? 'update' : 'create'}:${item.name}`,
      existing
        ? { kind: 'updateCommitment', id: existing.id, ...item, active: true }
        : { kind: 'commitment', ...item },
    );
  }
  data = await readData(userId);
  for (const item of input.investments)
    if (!(data.investments ?? []).some((row) => row.name.toLowerCase() === item.name.toLowerCase()))
      await run(`investment:${item.name}`, { kind: 'investment', ...item });
  for (const item of input.personalEntries)
    if (
      !(data.personalEntries ?? []).some(
        (row) =>
          row.direction === item.direction &&
          row.reference.toLowerCase() === item.reference.toLowerCase(),
      )
    )
      await run(`personal:${item.direction}:${item.reference}`, { kind: 'personalEntry', ...item });
  data = await readData(userId);
  for (const item of input.goals) {
    const existing = (data.goals ?? []).find(
      (row) => row.name.toLowerCase() === item.name.toLowerCase(),
    );
    await run(`goal:${existing ? 'update' : 'create'}:${item.name}`, {
      kind: 'goal',
      ...(existing ? { id: existing.id } : {}),
      ...item,
    });
  }
  const final = await readData(userId);
  console.log(
    JSON.stringify({
      accounts: final.accounts.length,
      incomes: final.incomes.length,
      cards: final.cards.length,
      commitments: final.commitments.length,
      investments: final.investments?.length ?? 0,
      personalEntries: final.personalEntries?.length ?? 0,
      goals: final.goals?.length ?? 0,
    }),
  );
  await db.$disconnect();
}
main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
