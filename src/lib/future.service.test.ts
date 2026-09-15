import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { today } from './finance';
import type { Command } from './validation';

describe.skipIf(process.env.RUN_DB_TESTS !== '1')(
  'Goal, investment and advance transactions',
  () => {
    let db: typeof import('./db').db,
      execute: typeof import('./service').execute,
      readData: typeof import('./service').readData,
      undoLatestAssistantAction: typeof import('./service').undoLatestAssistantAction;
    let userId = '',
      accountId = '';
    const run = (c: Command) => execute(userId, randomUUID(), c);
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
      ({ execute, readData, undoLatestAssistantAction } = await import('./service'));
      userId = (
        await db.user.create({
          data: {
            email: randomUUID() + '@test.invalid',
            ownerKey: randomUUID(),
            password: 'unused',
            name: 'Future test',
            salaryDay: 10,
            monthlyIncome: 5000000,
            essentialReserve: 0,
            emergencyReserve: 0,
            goalReserve: 0,
            extraDebtReserve: 0,
          },
        })
      ).id;
      accountId = (await run({
        kind: 'account',
        name: 'Bank',
        type: 'BANK',
        balance: 1000000,
        spendable: true,
      }))!.id;
    });
    afterAll(async () => {
      if (!userId) return;
      await db.investmentEvent.deleteMany({ where: { userId } });
      await db.investment.deleteMany({ where: { userId } });
      await db.goal.deleteMany({ where: { userId } });
      await db.personalAdvance.deleteMany({ where: { userId } });
      await db.personalSettlement.deleteMany({ where: { userId } });
      await db.personalEntry.deleteMany({ where: { userId } });
      await db.riskSnapshot.deleteMany({ where: { userId } });
      await db.audit.deleteMany({ where: { userId } });
      await db.account.deleteMany({ where: { userId } });
      await db.user.delete({ where: { id: userId } });
      await db.$disconnect();
    });
    it('moves contribution cash once and keeps valuation updates cash-neutral', async () => {
      const investment = await run({
        kind: 'investment',
        name: 'Index SIP',
        investmentKind: 'SIP',
        contributed: 0,
        currentValue: 0,
        monthlyContribution: 10000,
        nextContribution: null,
        maturityDate: null,
        liquid: false,
      });
      await run({
        kind: 'investmentEvent',
        id: investment!.id,
        eventKind: 'CONTRIBUTION',
        accountId,
        amount: 20000,
        date: today(),
      });
      await run({
        kind: 'investmentEvent',
        id: investment!.id,
        eventKind: 'VALUATION',
        accountId: null,
        amount: 22500,
        date: today(),
      });
      const data = await readData(userId);
      expect(data.accounts[0].balance).toBe(980000);
      expect(data.investments![0].contributed).toBe(20000);
      expect(data.investments![0].currentValue).toBe(22500);
      expect(data.expenses).toHaveLength(0);
    });
    it('stores a goal with expected funds separate and records new borrowing as principal', async () => {
      await run({
        kind: 'goal',
        name: 'Marriage',
        goalKind: 'MARRIAGE',
        targetDate: '2027-12-01',
        familyContribution: 100000,
        personalCash: 100000,
        engagement: 0,
        travel: 0,
        shopping: 0,
        emergencyBuffer: 0,
        otherAmount: 0,
        alreadySaved: 50000,
        confirmedMoney: 0,
        expectedMoney: 75000,
      });
      const debt = await run({
        kind: 'personalEntry',
        direction: 'PAYABLE',
        reference: 'Family',
        amount: 10000,
        openingSettled: 0,
        openingDate: today(),
        dueDate: null,
        priority: 'NORMAL',
        paymentReserve: 0,
      });
      await run({ kind: 'personalAdvance', id: debt!.id, accountId, amount: 30000, date: today() });
      await run({
        kind: 'personalTransfer',
        direction: 'PAYABLE',
        reference: 'New friend borrowing',
        accountId,
        amount: 5000,
        date: today(),
        dueDate: null,
        priority: 'NORMAL',
      });
      const data = await readData(userId);
      expect(data.goals![0].expectedMoney).toBe(75000);
      expect(data.personalEntries![0].amount).toBe(40000);
      expect(data.accounts[0].balance).toBe(1015000);
      expect(data.personalEntries).toHaveLength(2);
      expect(data.incomes).toHaveLength(0);
    });
    it('audits a confirmed assistant write and safely undoes it', async () => {
      const before = (await readData(userId)).accounts[0].balance;
      await execute(
        userId,
        randomUUID(),
        {
          kind: 'expense',
          amount: 1000,
          date: today(),
          category: 'Fuel',
          method: 'UPI',
          essentiality: 'MUST HAVE',
          accountId,
        },
        {
          source: 'FINANCE_ASSISTANT',
          conversationMessageId: 'test-message-12345',
          confirmedByUser: true,
        },
      );
      const audit = await db.audit.findFirstOrThrow({
        where: { userId, source: 'FINANCE_ASSISTANT' },
        orderBy: { createdAt: 'desc' },
      });
      expect(audit.confirmedByUser).toBe(true);
      expect(audit.conversationMessageId).toBe('test-message-12345');
      expect(audit.interpretation).not.toContain('Fuel');
      await undoLatestAssistantAction(userId);
      expect((await readData(userId)).accounts[0].balance).toBe(before);
      expect(
        (await db.audit.findUniqueOrThrow({ where: { id: audit.id } })).undoneAt,
      ).not.toBeNull();
    });
  },
);
