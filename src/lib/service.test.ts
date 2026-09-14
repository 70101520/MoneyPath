import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { today } from './finance';
import type { Command } from './validation';
const enabled = process.env.RUN_DB_TESTS === '1';
describe.skipIf(!enabled)('PostgreSQL transactional accounting', () => {
  let db: typeof import('./db').db,
    execute: typeof import('./service').execute,
    readData: typeof import('./service').readData;
  let userId: string;
  let accountId: string;
  let cardId: string;
  const date = today();
  const run = (command: Command, key = randomUUID()) => execute(userId, key, command);
  beforeAll(async () => {
    if (!existsSync('.env.test.local')) throw new Error('Start scripts/test-db.ts first');
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
    const user = await db.user.create({
      data: {
        email: randomUUID() + '@test.invalid',
        ownerKey: randomUUID(),
        name: 'Accounting test',
        password: 'unused',
        salaryDay: 10,
        monthlyIncome: 5500000,
        essentialReserve: 0,
        emergencyReserve: 0,
        goalReserve: 0,
        extraDebtReserve: 0,
      },
    });
    userId = user.id;
    accountId = (await run({
      kind: 'account',
      name: 'Test bank',
      type: 'BANK',
      balance: 1000000,
      spendable: true,
    }))!.id;
    cardId = (await run({
      kind: 'card',
      bank: 'Test bank',
      name: 'Test card',
      creditLimit: 5000000,
      availableLimit: null,
      outstanding: 0,
      statementAmount: 0,
      statementPaid: 0,
      statementDate: date,
      dueDate: date,
      minimumDue: 0,
      interestBps: 4200,
      status: 'ACTIVE',
    }))!.id;
  });
  afterAll(async () => {
    if (!userId) return;
    await db.riskSnapshot.deleteMany({ where: { userId } });
    await db.audit.deleteMany({ where: { userId } });
    await db.payment.deleteMany({ where: { userId } });
    await db.expense.deleteMany({ where: { userId } });
    await db.income.deleteMany({ where: { userId } });
    await db.emi.deleteMany({ where: { card: { userId } } });
    await db.cardStatement.deleteMany({ where: { card: { userId } } });
    await db.card.deleteMany({ where: { userId } });
    await db.commitment.deleteMany({ where: { userId } });
    await db.account.deleteMany({ where: { userId } });
    await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  });
  it('persists budgets idempotently without changing balances and scopes updates to the owner', async () => {
    const before = await readData(userId);
    const key = randomUUID();
    const command: Command = {
      kind: 'budget',
      month: date.slice(0, 7),
      category: ' Groceries ',
      amount: 300000,
    };
    const first = await run(command, key);
    expect((await run(command, key))?.duplicate).toBe(true);
    const updated = await run({ ...command, category: 'groceries', amount: 400000 });
    expect(updated?.id).toBe(first?.id);
    const after = await readData(userId);
    expect(after.budgets).toHaveLength(1);
    expect(after.budgets![0].amount).toBe(400000);
    expect(after.accounts).toEqual(before.accounts);
    expect(after.expenses).toEqual(before.expenses);
    expect(after.cards).toEqual(before.cards);
    const outsider = await db.user.create({
      data: {
        email: randomUUID() + '@test.invalid',
        ownerKey: randomUUID(),
        name: 'Other',
        password: 'unused',
      },
    });
    try {
      await execute(outsider.id, randomUUID(), { ...command, amount: 100 });
      expect((await readData(outsider.id)).budgets![0].amount).toBe(100);
      expect((await readData(userId)).budgets![0].amount).toBe(400000);
      await expect(execute(outsider.id, key, command)).rejects.toThrow('Request conflict');
    } finally {
      await db.riskSnapshot.deleteMany({ where: { userId: outsider.id } });
      await db.audit.deleteMany({ where: { userId: outsider.id } });
      await db.user.delete({ where: { id: outsider.id } });
    }
  });
  it('purchase then repayment changes debt and cash but records one expense', async () => {
    await run({
      kind: 'expense',
      amount: 200000,
      date,
      category: 'Groceries',
      method: 'Credit Card',
      essentiality: 'MUST HAVE',
      cardId,
      description: 'Private grocery note',
    });
    await run({ kind: 'payment', accountId, cardId, amount: 200000, date, type: 'UNBILLED' });
    const data = await readData(userId);
    expect(data.cards[0].outstanding).toBe(0);
    expect(data.accounts[0].balance).toBe(800000);
    expect(data.expenses.reduce((a, e) => a + e.amount, 0)).toBe(200000);
    const raw = await db.expense.findFirstOrThrow({ where: { userId } });
    expect(raw.description).not.toContain('Private grocery note');
    expect(data.expenses[0].description).toBe('Private grocery note');
  });
  it('duplicate concurrent requests debit once', async () => {
    const key = randomUUID();
    const c: Command = {
      kind: 'expense',
      amount: 10000,
      date,
      category: 'Fuel',
      method: 'UPI',
      essentiality: 'MUST HAVE',
      accountId,
    };
    await Promise.all([run(c, key), run(c, key)]);
    expect((await db.account.findUniqueOrThrow({ where: { id: accountId } })).balance).toBe(790000);
    expect(await db.audit.count({ where: { requestId: key } })).toBe(1);
  });
  it('rejects idempotency-key reuse with a different amount', async () => {
    const key = randomUUID();
    const c: Command = {
      kind: 'income',
      amount: 100,
      date,
      source: 'Other Income',
      status: 'EXPECTED',
      recurring: false,
    };
    await run(c, key);
    await expect(run({ ...c, amount: 200 }, key)).rejects.toThrow('Request conflict');
  });
  it('concurrent overspending rolls back one transaction', async () => {
    const c: Command = {
      kind: 'expense',
      amount: 600000,
      date,
      category: 'Other',
      method: 'UPI',
      essentiality: 'MUST HAVE',
      accountId,
    };
    const results = await Promise.allSettled([run(c), run(c)]);
    expect(
      results.filter((r) => r.status === 'fulfilled'),
      JSON.stringify(results, (_, v) => (v instanceof Error ? { ...v, message: v.message } : v)),
    ).toHaveLength(1);
    expect((await db.account.findUniqueOrThrow({ where: { id: accountId } })).balance).toBe(190000);
  });
  it('expected income does not credit cash until received and cannot be received twice', async () => {
    const i = await run({
      kind: 'income',
      amount: 500000,
      date,
      source: 'Salary',
      status: 'EXPECTED',
      recurring: true,
    });
    expect((await db.account.findUniqueOrThrow({ where: { id: accountId } })).balance).toBe(190000);
    await run({ kind: 'receiveIncome', id: i!.id, accountId, date });
    await expect(run({ kind: 'receiveIncome', id: i!.id, accountId, date })).rejects.toThrow();
    expect((await db.account.findUniqueOrThrow({ where: { id: accountId } })).balance).toBe(690000);
  });
  it('commitment payment makes one expense and advances recurrence only when fully paid', async () => {
    const c = await run({
      kind: 'commitment',
      name: 'Tuition',
      category: 'Tuition',
      amount: 100000,
      intervalMonths: 1,
      dueDate: date,
      funded: 100000,
      essential: true,
    });
    await run({
      kind: 'payment',
      type: 'COMMITMENT',
      accountId,
      commitmentId: c!.id,
      amount: 40000,
      date,
    });
    expect((await db.commitment.findUniqueOrThrow({ where: { id: c!.id } })).paid).toBe(40000);
    await run({
      kind: 'payment',
      type: 'COMMITMENT',
      accountId,
      commitmentId: c!.id,
      amount: 60000,
      date,
    });
    const updated = await db.commitment.findUniqueOrThrow({ where: { id: c!.id } });
    expect(updated.paid).toBe(0);
    expect(updated.funded).toBe(0);
    expect(updated.dueDate.toISOString().slice(0, 10) > date).toBe(true);
    expect(
      (
        await db.expense.aggregate({
          where: { userId, category: 'Tuition' },
          _sum: { amount: true },
        })
      )._sum.amount,
    ).toBe(100000);
  });
  it('EMI posting transfers principal and records only interest', async () => {
    const emi = await run({
      kind: 'emi',
      cardId,
      name: 'Laptop',
      originalAmount: 200000,
      principalRemaining: 200000,
      monthlyEmi: 105000,
      nextPrincipal: 100000,
      nextInterest: 5000,
      totalInstallments: 2,
      installmentsPaid: 0,
      nextDate: date,
    });
    await run({ kind: 'postEmi', id: emi!.id, date, principal: 100000, interest: 5000 });
    expect((await db.card.findUniqueOrThrow({ where: { id: cardId } })).outstanding).toBe(105000);
    expect((await db.emi.findUniqueOrThrow({ where: { id: emi!.id } })).principalRemaining).toBe(
      100000,
    );
    expect(
      (
        await db.expense.aggregate({
          where: { userId, category: 'Interest' },
          _sum: { amount: true },
        })
      )._sum.amount,
    ).toBe(5000);
    await expect(
      run({ kind: 'postEmi', id: emi!.id, date, principal: 100000, interest: 5000 }),
    ).rejects.toThrow('not due');
  });
  it('invalid ownership cannot move cash', async () => {
    await expect(
      run({
        kind: 'expense',
        amount: 100,
        date,
        category: 'Other',
        method: 'UPI',
        essentiality: 'MUST HAVE',
        accountId: 'not-owned',
      }),
    ).rejects.toThrow();
  });
  it('investment commitment is a transfer, not an expense', async () => {
    const investment = (await run({
      kind: 'account',
      name: 'SIP asset',
      type: 'INVESTMENT',
      balance: 0,
      spendable: false,
    }))!.id;
    const commitment = (await run({
      kind: 'commitment',
      name: 'SIP',
      category: 'SIP',
      amount: 10000,
      intervalMonths: 1,
      dueDate: date,
      funded: 0,
      essential: false,
    }))!.id;
    const before = await db.expense.count({ where: { userId } });
    await run({
      kind: 'payment',
      type: 'COMMITMENT',
      amount: 10000,
      date,
      accountId,
      commitmentId: commitment,
      destinationAccountId: investment,
    });
    expect(await db.expense.count({ where: { userId } })).toBe(before);
    expect((await db.account.findUniqueOrThrow({ where: { id: investment } })).balance).toBe(10000);
  });
  it('a new financed purchase creates one purchase expense and unbilled EMI debt', async () => {
    const expenseBefore = (
      await db.expense.aggregate({ where: { userId }, _sum: { amount: true } })
    )._sum.amount!;
    const cardBefore = (await db.card.findUniqueOrThrow({ where: { id: cardId } })).outstanding;
    await run({
      kind: 'emi',
      cardId,
      name: 'New appliance',
      newPurchase: true,
      purchaseDate: date,
      originalAmount: 400000,
      principalRemaining: 400000,
      monthlyEmi: 102000,
      nextPrincipal: 100000,
      nextInterest: 2000,
      totalInstallments: 4,
      installmentsPaid: 0,
      nextDate: date,
    });
    expect(
      (await db.expense.aggregate({ where: { userId }, _sum: { amount: true } }))._sum.amount,
    ).toBe(expenseBefore + 400000);
    expect((await db.card.findUniqueOrThrow({ where: { id: cardId } })).outstanding).toBe(
      cardBefore,
    );
  });
  it('database constraints reject negative balances even outside the service', async () => {
    await expect(
      db.account.update({ where: { id: accountId }, data: { balance: -1 } }),
    ).rejects.toThrow();
  });
  it('rolls an unpaid bill forward without losing the old due date or double counting debt', async () => {
    const c = (await run({
      kind: 'card',
      bank: 'Rollover issuer',
      name: 'Rollover card',
      creditLimit: 5000000,
      availableLimit: null,
      outstanding: 120000,
      statementAmount: 100000,
      statementPaid: 20000,
      statementDate: '2026-07-01',
      dueDate: '2026-07-20',
      minimumDue: 10000,
      interestBps: 4200,
      status: 'ACTIVE',
    }))!.id;
    const expenseCount = await db.expense.count({ where: { userId } });
    await run({
      kind: 'statement',
      id: c,
      statementAmount: 120000,
      statementDate: '2026-08-01',
      dueDate: '2026-08-20',
      minimumDue: 15000,
      availableLimit: null,
      status: 'ACTIVE',
    });
    let updated = await db.card.findUniqueOrThrow({ where: { id: c } });
    expect(updated.outstanding).toBe(120000);
    expect(updated.carriedBalance).toBe(80000);
    expect(updated.carriedDueDate!.toISOString().slice(0, 10)).toBe('2026-07-20');
    const { calculate } = await import('./finance');
    const summary = calculate(await readData(userId), '2026-08-10');
    expect(
      summary.obligations
        .filter((o) => o.id === c || o.id === c + ':carried')
        .reduce((sum, o) => sum + o.amount, 0),
    ).toBe(120000);
    await run({ kind: 'payment', accountId, cardId: c, type: 'STATEMENT', amount: 30000, date });
    updated = await db.card.findUniqueOrThrow({ where: { id: c } });
    expect(updated.carriedBalance).toBe(50000);
    expect(updated.outstanding).toBe(90000);
    expect(updated.statementPaid).toBe(30000);
    expect(await db.cardStatement.count({ where: { cardId: c } })).toBe(1);
    expect(await db.expense.count({ where: { userId } })).toBe(expenseCount);
  });
});
