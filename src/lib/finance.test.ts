import { describe, it, expect } from 'vitest';
import {
  emiOccurrences,
  monthlyReserve,
  safeToSpend,
  statementBalance,
  unbilledSpending,
  cardPayment,
  postEmi,
  budgetVariance,
  debtReduction,
  goalShortfall,
  riskScore,
  addMonths,
  nextSalary,
  calculate,
  type Data,
} from './finance';

describe('accounting invariants', () => {
  it('reserves cash, clamps availability and exposes shortfall', () => {
    expect(safeToSpend(3100000, [2450000, 180000])).toEqual({
      available: 470000,
      shortfall: 0,
      raw: 470000,
    });
    expect(safeToSpend(100, [200])).toEqual({ available: 0, shortfall: 100, raw: -100 });
    expect(safeToSpend(100, [null]).available).toBeNull();
  });
  it('rounds long-cycle reserve upward to a paise', () => {
    expect(monthlyReserve(2500000, 12)).toBe(208334);
    expect(monthlyReserve(900000, 3)).toBe(300000);
    expect(() => monthlyReserve(100, 0)).toThrow();
  });
  it('separates statement from unbilled', () => {
    expect(statementBalance(1200000, 200000)).toBe(1000000);
    expect(unbilledSpending(1400000, 1000000)).toBe(400000);
    expect(() => unbilledSpending(100, 200)).toThrow();
  });
  it('purchase and repayment count the expense exactly once', () => {
    const groceries = 200000;
    const card = { outstanding: groceries, statementAmount: groceries, statementPaid: 0 };
    const paid = cardPayment(card, groceries, 'STATEMENT', 500000);
    expect(groceries + paid.expense).toBe(200000);
    expect(paid.outstanding).toBe(0);
    expect(paid.cash).toBe(300000);
    expect(paid.statementPaid).toBe(groceries);
  });
  it('rejects overpayment and misallocation', () => {
    const c = { outstanding: 1000, statementAmount: 800, statementPaid: 0 };
    expect(() => cardPayment(c, 900, 'STATEMENT', 1000)).toThrow();
    expect(() => cardPayment(c, 300, 'UNBILLED', 1000)).toThrow();
    expect(() => cardPayment(c, 500, 'STATEMENT', 100)).toThrow();
  });
  it('EMI principal transfer does not invent expenses or debt', () => {
    const posting = postEmi(1000000, 100000, 10000);
    expect(posting.principalRemaining + posting.outstandingIncrease).toBe(1010000);
    expect(posting.expense).toBe(10000);
    expect(() => postEmi(100, 200, 0)).toThrow();
  });
  it('calculates budget variance, debt reduction and confirmed goal shortfall', () => {
    expect(budgetVariance(200000, 350000)).toEqual({
      difference: -150000,
      percentage: 175,
      overBudget: true,
    });
    expect(budgetVariance(0, 100).percentage).toBeNull();
    expect(debtReduction(2000000, 600000)).toBe(1400000);
    expect(goalShortfall(5000000, 1000000, 500000, 9999999)).toBe(3500000);
  });
  it('clamps month ends without recurrence drift', () => {
    const feb = addMonths('2026-01-31', 1, 31);
    expect(feb.toISOString().slice(0, 10)).toBe('2026-02-28');
    expect(addMonths(feb, 1, 31).toISOString().slice(0, 10)).toBe('2026-03-31');
    expect(nextSalary('2026-09-10', 10).toISOString().slice(0, 10)).toBe('2026-10-10');
  });
  it('reserves all missed EMI installments without extending past the schedule', () => {
    const e = {
      id: 'e',
      cardId: 'c',
      name: 'EMI',
      originalAmount: 300000,
      principalRemaining: 300000,
      monthlyEmi: 110000,
      nextPrincipal: 100000,
      nextInterest: 10000,
      totalInstallments: 3,
      installmentsPaid: 0,
      nextDate: '2026-07-31',
      anchorDay: 31,
    };
    expect(emiOccurrences(e, '2026-09-30').map((o) => o.date)).toEqual([
      '2026-07-31',
      '2026-08-31',
      '2026-09-30',
    ]);
    expect(emiOccurrences(e, '2027-01-01')).toHaveLength(3);
  });
});
describe('risk engine', () => {
  const base = {
    income: 5500000,
    debt: 0,
    oldBill: 0,
    newSpending: 0,
    utilization: 0,
    overdue: false,
    monthlyCommitments: 1000000,
    emergency: 1000000,
    essentials: 500000,
    raw: 500000,
  };
  it('returns explainable deterministic rules', () => {
    const r = riskScore({
      ...base,
      debt: 9000000,
      oldBill: 100000,
      newSpending: 10000,
      utilization: 0.9,
      overdue: true,
      raw: -100,
    });
    expect(r.score).toBe(85);
    expect(r.label).toBe('Critical');
    expect(r.rules.reduce((a, r) => a + r.points, 0)).toBe(r.score);
  });
  it('does not make missing data look low risk', () => {
    expect(riskScore({ ...base, income: null }).score).toBeNull();
    expect(riskScore(base).score).toBe(0);
  });
});
describe('snapshot reserves', () => {
  const data: Data = {
    settings: {
      name: 'Test',
      salaryDay: 10,
      monthlyIncome: 5500000,
      essentialReserve: 0,
      emergencyReserve: 0,
      goalReserve: 0,
      extraDebtReserve: 0,
    },
    accounts: [{ id: 'a', name: 'Bank', kind: 'BANK', balance: 10000000, spendable: true }],
    cards: [],
    commitments: [],
    expenses: [],
    incomes: [],
    payments: [],
  };
  it('does not count expected salary or credit limit as cash', () => {
    expect(
      calculate(
        {
          ...data,
          incomes: [
            {
              id: 'i',
              amount: 5500000,
              date: '2026-09-20',
              source: 'Salary',
              status: 'EXPECTED',
              recurring: true,
              notes: null,
              accountId: null,
            },
          ],
        },
        '2026-09-13',
      ).cash,
    ).toBe(10000000);
  });
  it('does not double reserve the due amount and monthly sinking fund', () => {
    const c = {
      id: 'c',
      name: 'LIC',
      category: 'LIC',
      amount: 1200000,
      intervalMonths: 12,
      dueDate: '2026-09-20',
      anchorDay: 20,
      funded: 500000,
      paid: 0,
      essential: true,
      active: true,
    };
    expect(calculate({ ...data, commitments: [c] }, '2026-09-13').commitmentReserve).toBe(1200000);
    expect(
      calculate({ ...data, commitments: [{ ...c, dueDate: '2027-09-20' }] }, '2026-09-13')
        .commitmentReserve,
    ).toBe(600000);
  });
  it('includes overdue recurring periods', () => {
    const c = {
      id: 'c',
      name: 'Tuition',
      category: 'Tuition',
      amount: 10000,
      intervalMonths: 1,
      dueDate: '2026-08-20',
      anchorDay: 20,
      funded: 0,
      paid: 0,
      essential: true,
      active: true,
    };
    expect(calculate({ ...data, commitments: [c] }, '2026-09-13').commitmentReserve).toBe(20000);
  });
});
