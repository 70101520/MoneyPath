import { describe, expect, it } from 'vitest';
import { calculate, type Data } from './finance';
import { sampleData } from './sample';
import {
  debtForecast,
  historyReports,
  paymentPriority,
  planningNotifications,
  salaryAllocation,
  simulatePurchase,
} from './decision';
import { requestId } from './request-id';
import { commandSchema } from './validation';

const asOf = '2026-09-14';
function fixture(): Data {
  const data = sampleData(asOf);
  data.accounts = [{ id: 'bank', name: 'Bank', kind: 'BANK', balance: 1000000, spendable: true }];
  data.settings = {
    name: 'Test',
    salaryDay: 10,
    monthlyIncome: 5500000,
    essentialReserve: 100000,
    emergencyReserve: 100000,
    goalReserve: 0,
    extraDebtReserve: 0,
  };
  data.cards = [];
  data.commitments = [];
  data.incomes = [];
  data.expenses = [];
  data.payments = [];
  data.budgets = [];
  data.risks = [];
  return data;
}
function card(id: string, outstanding: number, rate: number) {
  const c = sampleData(asOf).cards[0];
  return {
    ...c,
    id,
    name: id,
    creditLimit: 5000000,
    outstanding,
    statementAmount: outstanding,
    statementPaid: 0,
    carriedBalance: 0,
    carriedDueDate: null,
    availableLimit: null,
    minimumDue: 10000,
    dueDate: '2026-09-16',
    statementDate: '2026-09-01',
    emis: [],
    interestBps: rate,
  };
}
describe('Phase 2 decision calculations', () => {
  it('salary planning replaces reserves without crediting salary or moving cash', () => {
    const data = fixture();
    const plan = salaryAllocation(
      data,
      {
        essentialReserve: 200000,
        emergencyReserve: 100000,
        goalReserve: 100000,
        extraDebtReserve: 200000,
      },
      asOf,
    );
    expect(plan.cash).toBe(1000000);
    expect(plan.safe.available).toBe(400000);
    expect(data.settings.essentialReserve).toBe(100000);
  });
  it('payment recommendations preserve food, emergency and other bills during a shortfall', () => {
    const data = fixture();
    data.cards = [card('a', 600000, 4200), card('b', 400000, 1000)];
    const p = paymentPriority(data, asOf);
    expect(p.safe.shortfall).toBe(200000);
    expect(p.ranked[0].id).toBe('a');
    expect(p.ranked[0].payable).toBe(400000);
    expect(p.ranked[0].action).toBe('Funding shortfall');
    expect(data.accounts[0].balance - p.ranked[0].payable!).toBe(600000);
  });
  it('never recommends payment from unknown settings or before earlier recurrences', () => {
    const data = fixture();
    data.settings.essentialReserve = null;
    data.cards = [card('a', 100000, 0)];
    expect(paymentPriority(data, asOf).ranked[0].payable).toBeNull();
    data.settings.essentialReserve = 0;
    data.commitments = [
      {
        ...sampleData(asOf).commitments[0],
        id: 'bill',
        amount: 10000,
        paid: 0,
        funded: 0,
        dueDate: '2026-08-01',
        intervalMonths: 1,
        anchorDay: 1,
        active: true,
      },
    ];
    const rows = paymentPriority(data, asOf).ranked.filter((r) => r.id.startsWith('bill'));
    expect(rows[0].canRecord).toBe(true);
    expect(rows.slice(1).every((r) => !r.canRecord)).toBe(true);
  });
  it('purchase simulation preserves data and reserves full card repayment once', () => {
    const data = fixture();
    data.cards = [card('a', 0, 0)];
    const original = structuredClone(data);
    const result = simulatePurchase(
      data,
      { item: 'Phone', price: 100000, method: 'CARD', essentiality: 'WANT', cardId: 'a' },
      asOf,
    );
    expect(result.cashAfter).toBe(1000000);
    expect(result.debtAfter).toBe(100000);
    expect(result.after?.safe.available).toBe(700000);
    expect(result.after?.newSpending).toBe(100000);
    expect(data).toEqual(original);
    const cash = simulatePurchase(
      data,
      {
        item: 'Groceries',
        price: 100000,
        method: 'CASH',
        essentiality: 'MUST HAVE',
        accountId: 'bank',
      },
      asOf,
    );
    expect(cash.cashAfter).toBe(900000);
    expect(cash.after?.safe.available).toBe(700000);
  });
  it('blocks unsafe and unfunded purchases and does not invent missing data', () => {
    const data = fixture();
    expect(
      simulatePurchase(
        data,
        { item: 'Phone', price: 900000, method: 'CASH', essentiality: 'WANT', accountId: 'bank' },
        asOf,
      ).level,
    ).toBe(4);
    data.settings.salaryDay = null;
    expect(
      simulatePurchase(
        data,
        { item: 'Phone', price: 100, method: 'CASH', essentiality: 'WANT', accountId: 'bank' },
        asOf,
      ).label,
    ).toBe('Information Required');
    expect(() =>
      simulatePurchase(
        data,
        { item: 'Phone', price: 0.5, method: 'CASH', essentiality: 'WANT' },
        asOf,
      ),
    ).toThrow();
  });
  it('computes exact zero-interest payoff and caps the final payment', () => {
    const data = fixture();
    data.cards = [card('a', 250000, 0)];
    const result = debtForecast(
      data,
      100000,
      'AVALANCHE',
      [{ cardId: 'a', annualRateBps: 0, minimum: 10000, rank: 1 }],
      asOf,
    );
    expect(result.months).toBe(3);
    expect(result.interest).toBe(0);
    expect(result.schedule.map((r) => r.payment)).toEqual([100000, 100000, 50000]);
    expect(result.debtFree).toBe('2026-12');
    expect(result.payoff).toEqual([{ card: 'a', month: '2026-12' }]);
  });
  it('applies monthly interest before payments and exposes underfunded/non-amortizing plans', () => {
    const data = fixture();
    data.cards = [card('a', 100000, 1200)];
    const a = [{ cardId: 'a', annualRateBps: 1200, minimum: 1000, rank: 1 }];
    expect(debtForecast(data, 101000, 'AVALANCHE', a, asOf).interest).toBe(1000);
    expect(debtForecast(data, 500, 'AVALANCHE', a, asOf).reason).toMatch(/minimums/);
    expect(debtForecast(data, 1000, 'AVALANCHE', a, asOf).reason).toMatch(/does not cover/);
    expect(debtForecast(data, 1000, 'AVALANCHE', [], asOf).missing).toHaveLength(1);
  });
  it('avalanche, snowball and custom priorities choose different targets with identical minimums', () => {
    const data = fixture();
    data.cards = [card('expensive', 500000, 3600), card('small', 100000, 1200)];
    const a = [
      { cardId: 'expensive', annualRateBps: 3600, minimum: 10000, rank: 2 },
      { cardId: 'small', annualRateBps: 1200, minimum: 10000, rank: 1 },
    ];
    const avalanche = debtForecast(data, 80000, 'AVALANCHE', a, asOf),
      snowball = debtForecast(data, 80000, 'SNOWBALL', a, asOf);
    expect(avalanche.schedule[0].target).toBe('expensive');
    expect(snowball.schedule[0].target).toBe('small');
    expect(debtForecast(data, 80000, 'CUSTOM', a, asOf).schedule[0].target).toBe('small');
    expect(avalanche.interest!).toBeLessThan(snowball.interest!);
    expect(avalanche.schedule.reduce((n, r) => n + r.payment, 0)).toBe(
      avalanche.total + avalanche.interest!,
    );
  });
  it('notifications explain budget/shortfall triggers and risk v2 records signed rules', () => {
    const data = fixture();
    data.accounts[0].balance = 100000;
    data.budgets = [{ id: 'b', month: '2026-09', category: 'shopping', amount: 0 }];
    data.expenses = [
      {
        id: 'e',
        amount: 10000,
        category: 'Shopping',
        essentiality: 'WANT',
        method: 'Credit Card',
        cardId: 'a',
        accountId: null,
        description: null,
        date: asOf,
      },
    ];
    const alerts = planningNotifications(data, asOf);
    expect(alerts.some((a) => a.id === 'budget-shopping')).toBe(true);
    expect(alerts.some((a) => a.id === 'low-cash')).toBe(true);
    const result = calculate(data, asOf);
    expect(result.riskVersion).toBe('planning-v2');
    expect(result.risk.rules.some((r) => r.id === 'budget-overrun')).toBe(true);
    expect(result.risk.score).toBe(
      Math.min(
        100,
        result.risk.rules.reduce((n, r) => n + r.points, 0),
      ),
    );
  });
  it('reports avoid repayment double counting and leave unavailable historic balances unknown', () => {
    const data = fixture();
    data.expenses = [
      {
        id: 'e',
        amount: 20000,
        category: 'Groceries',
        essentiality: 'MUST HAVE',
        method: 'Credit Card',
        cardId: 'a',
        accountId: null,
        description: null,
        date: asOf,
      },
    ];
    data.payments = [
      {
        id: 'p',
        amount: 20000,
        date: asOf,
        cardId: 'a',
        accountId: 'bank',
        commitmentId: null,
        notes: null,
        type: 'STATEMENT',
      },
    ];
    const report = historyReports(data, '2026-09').at(-1)!;
    expect(report.total).toBe(20000);
    expect(report.cashOut).toBe(20000);
    expect(report.netDebtReduction).toBe(0);
    expect(report.metrics).toBeNull();
    expect(report.score).toBeNull();
  });
  it('HTTP-compatible request IDs are valid unique UUIDs', () => {
    const values = Array.from({ length: 100 }, requestId);
    expect(new Set(values).size).toBe(100);
    expect(
      values.every((v) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v),
      ),
    ).toBe(true);
  });
  it('groups snapshot timestamps into Indian calendar months', () => {
    const data = fixture();
    data.risks = [
      {
        id: 'r',
        createdAt: '2026-08-31T20:00:00.000Z',
        version: 'planning-v2',
        score: 20,
        rules: [],
        metrics: { cash: 1000000, assets: 1000000, debt: 100000, netWorth: 900000 },
      },
    ];
    const rows = historyReports(data, '2026-09');
    expect(rows.at(-1)!.metrics?.debt).toBe(100000);
    expect(rows.at(-2)!.metrics).toBeNull();
  });
  it('uses known late fees to break payment priority ties without posting an expense', () => {
    const data = fixture();
    data.cards = [card('a', 10000, 0), { ...card('b', 10000, 0), lateFee: 50000 }];
    const p = paymentPriority(data, asOf);
    expect(p.ranked[0].id).toBe('b');
    expect(p.ranked[0].lateFee).toBe(50000);
    expect(data.expenses).toHaveLength(0);
  });
  it('keeps distant reserves below payments due before salary', () => {
    const result = paymentPriority(sampleData(asOf), asOf);
    const firstFuture = result.ranked.findIndex((r) => !r.withinHorizon);
    expect(firstFuture).toBeGreaterThan(0);
    expect(result.ranked.slice(firstFuture).every((r) => !r.withinHorizon)).toBe(true);
  });
  it('rejects duplicate debt targets, ambiguous priorities and invalid rates', () => {
    const a = { cardId: 'a', annualRateBps: 1200, minimum: 100, rank: 1 };
    for (const assumptions of [
      [a, a],
      [a, { ...a, cardId: 'b' }],
      [{ ...a, annualRateBps: 10001 }],
    ])
      expect(
        commandSchema.safeParse({
          kind: 'debtPlan',
          monthlyPayment: 10000,
          strategy: 'CUSTOM',
          assumptions,
        }).success,
      ).toBe(false);
  });
});
