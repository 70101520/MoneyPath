import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { today, calculate } from './finance';
import { historyReports } from './decision';
import type { Command } from './validation';
describe.skipIf(process.env.RUN_DB_TESTS !== '1')('Private balance transactions', () => {
  let db: typeof import('./db').db,
    execute: typeof import('./service').execute,
    readData: typeof import('./service').readData;
  let userId: string, accountId: string;
  const date = today();
  const run = (c: Command, key = randomUUID()) => execute(userId, key, c);
  beforeAll(async () => {
    config({ path: '.env.test.local', override: true, quiet: true });
    const url = new URL(process.env.DATABASE_URL!);
    if (
      url.hostname !== '127.0.0.1' ||
      url.port !== '55432' ||
      url.pathname !== '/moneypath_test_utf8'
    )
      throw new Error('Refusing non-test database');
    ({ db } = await import('./db'));
    ({ execute, readData } = await import('./service'));
    userId = (
      await db.user.create({
        data: {
          email: randomUUID() + '@test.invalid',
          ownerKey: randomUUID(),
          password: 'unused',
          name: 'Personal balance test',
          salaryDay: 10,
          monthlyIncome: 5500000,
          essentialReserve: 100000,
          emergencyReserve: 100000,
          goalReserve: 0,
          extraDebtReserve: 0,
        },
      })
    ).id;
    accountId = (await run({
      kind: 'account',
      name: 'Test bank',
      type: 'BANK',
      spendable: true,
      balance: 1000000,
    }))!.id;
  });
  afterAll(async () => {
    if (!userId) return;
    await db.personalSettlement.deleteMany({ where: { userId } });
    await db.personalEntry.deleteMany({ where: { userId } });
    await db.riskSnapshot.deleteMany({ where: { userId } });
    await db.audit.deleteMany({ where: { userId } });
    await db.account.deleteMany({ where: { userId } });
    await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  });
  it('credits received principal once, encrypts private identity and excludes opening history from cash', async () => {
    const row = await run({
      kind: 'personalEntry',
      direction: 'RECEIVABLE',
      reference: 'Private friend',
      amount: 100000,
      openingSettled: 10000,
      openingDate: date,
      dueDate: date,
      priority: 'NORMAL',
      paymentReserve: 0,
      notes: 'Private loan reference',
    });
    expect((await readData(userId)).accounts[0].balance).toBe(1000000);
    const raw = await db.personalEntry.findUniqueOrThrow({ where: { id: row!.id } });
    expect(raw.reference).not.toContain('Private friend');
    expect(raw.notes).not.toContain('Private loan reference');
    const key = randomUUID(),
      command: Command = {
        kind: 'personalSettlement',
        id: row!.id,
        accountId,
        amount: 50000,
        date,
      };
    await Promise.all([run(command, key), run(command, key)]);
    const after = await readData(userId);
    expect(after.accounts[0].balance).toBe(1050000);
    expect(after.personalEntries![0].settled).toBe(60000);
    expect(after.settlements).toHaveLength(1);
    expect(after.incomes).toHaveLength(0);
    expect(after.expenses).toHaveLength(0);
    await expect(run({ ...command, amount: 40001 })).rejects.toThrow('exceeds remaining');
  });
  it('repays debt once and releases its reserve without creating another expense', async () => {
    const row = await run({
      kind: 'personalEntry',
      direction: 'PAYABLE',
      reference: 'Family loan',
      amount: 200000,
      openingSettled: 0,
      openingDate: date,
      dueDate: date,
      priority: 'HIGH',
      paymentReserve: 50000,
    });
    const before = await readData(userId),
      beforeSafe = calculate(before).safe;
    expect(calculate(before).privateDebtReserve).toBe(200000);
    await run({ kind: 'personalSettlement', id: row!.id, accountId, amount: 50000, date });
    const after = await readData(userId);
    expect(after.accounts[0].balance).toBe(1000000);
    expect(calculate(after).privateDebt).toBe(150000);
    expect(calculate(after).safe).toEqual(beforeSafe);
    expect(after.expenses).toHaveLength(0);
    expect(after.incomes).toHaveLength(0);
    const report = historyReports(after).at(-1)!;
    expect(report.personalIn).toBe(50000);
    expect(report.personalOut).toBe(50000);
    expect(report.total).toBe(0);
    expect(report.netCashFlow).toBe(0);
    expect(after.risks![0].metrics?.netWorth).toBe(850000);
    await expect(
      run({
        kind: 'personalSchedule',
        id: row!.id,
        reference: 'Family loan',
        dueDate: null,
        priority: 'NORMAL',
        paymentReserve: 150001,
      }),
    ).rejects.toThrow('exceeds remaining');
  });
  it('rejects another owner’s account and concurrent over-settlement', async () => {
    const row = await run({
      kind: 'personalEntry',
      direction: 'RECEIVABLE',
      reference: 'Concurrent test',
      amount: 10000,
      openingSettled: 0,
      openingDate: date,
      dueDate: null,
      priority: 'NORMAL',
      paymentReserve: 0,
    });
    await expect(
      run({ kind: 'personalSettlement', id: row!.id, accountId: 'not-owned', amount: 1000, date }),
    ).rejects.toThrow();
    const results = await Promise.allSettled([
      run({ kind: 'personalSettlement', id: row!.id, accountId, amount: 7000, date }),
      run({ kind: 'personalSettlement', id: row!.id, accountId, amount: 7000, date }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await db.personalEntry.findUniqueOrThrow({ where: { id: row!.id } })).settled).toBe(
      7000,
    );
    await expect(
      execute('not-owner', randomUUID(), {
        kind: 'personalSettlement',
        id: row!.id,
        accountId,
        amount: 1000,
        date,
      }),
    ).rejects.toThrow();
  });
});
