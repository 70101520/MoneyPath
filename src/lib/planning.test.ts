import { describe, expect, it } from 'vitest';
import { spendingReport } from './planning';
import { sampleData } from './sample';
import { commandSchema } from './validation';

describe('Monthly budgets and spending analysis', () => {
  const fixture = () => {
    const data = sampleData('2026-01-15');
    data.expenses = [
      {
        id: 'a',
        amount: 240000,
        date: '2026-01-10',
        category: ' Groceries ',
        method: 'Credit Card',
        essentiality: 'MUST HAVE',
        cardId: 'card',
        accountId: null,
        description: null,
      },
      {
        id: 'b',
        amount: 100000,
        date: '2025-12-31',
        category: 'groceries',
        method: 'UPI',
        essentiality: 'WANT',
        cardId: null,
        accountId: 'account',
        description: null,
      },
      {
        id: 'c',
        amount: 50000,
        date: '2026-02-01',
        category: 'Groceries',
        method: 'UPI',
        essentiality: 'WANT',
        cardId: null,
        accountId: 'account',
        description: null,
      },
    ];
    data.payments = [
      {
        id: 'p',
        amount: 240000,
        date: '2026-01-12',
        type: 'STATEMENT',
        accountId: 'account',
        cardId: 'card',
        commitmentId: null,
        notes: null,
      },
    ];
    data.budgets = [{ id: 'b', month: '2026-01', category: 'groceries', amount: 300000 }];
    return data;
  };
  it('counts card purchases once and separates repayments across year boundaries', () => {
    const result = spendingReport(fixture(), '2026-01');
    expect(result.total).toBe(240000);
    expect(result.debtPayments).toBe(240000);
    expect(result.cardSpending).toBe(240000);
    expect(result.previousMonth).toBe('2025-12');
    expect(result.priorTotal).toBe(100000);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].variance).toEqual({
      difference: 60000,
      percentage: 80,
      overBudget: false,
    });
  });
  it('distinguishes absent budgets from an explicit zero and excludes budgets from other months', () => {
    const data = fixture();
    data.budgets![0].month = '2025-12';
    expect(spendingReport(data, '2026-01').rows[0].variance).toBeNull();
    expect(spendingReport(data, '2026-01').unbudgeted).toBe(240000);
    data.budgets![0] = { ...data.budgets![0], month: '2026-01', amount: 0 };
    expect(spendingReport(data, '2026-01').rows[0].variance).toEqual({
      difference: -240000,
      percentage: null,
      overBudget: true,
    });
  });
  it('never invents percentages from missing prior spending or counts expected income', () => {
    const data = fixture();
    data.expenses = [];
    data.incomes = data.incomes.map((i) => ({ ...i, status: 'EXPECTED' }));
    const result = spendingReport(data, '2026-01');
    expect(result.percentageChange).toBeNull();
    expect(result.income).toBe(0);
    expect(result.rows[0].variance?.percentage).toBe(0);
  });
  it('validates calendar months, paise bounds and normalizes categories', () => {
    expect(
      commandSchema.parse({
        kind: 'budget',
        month: '2026-01',
        category: ' Eating   Out ',
        amount: 100,
      }),
    ).toMatchObject({ category: 'eating out' });
    for (const month of ['2026-00', '2026-13', '2026-1', '1999-12']) {
      expect(
        commandSchema.safeParse({ kind: 'budget', month, category: 'Food', amount: 0 }).success,
      ).toBe(false);
      expect(() => spendingReport(fixture(), month)).toThrow();
    }
    for (const amount of [-1, 0.1, 1000000001])
      expect(
        commandSchema.safeParse({ kind: 'budget', month: '2026-01', category: 'Food', amount })
          .success,
      ).toBe(false);
  });
});
