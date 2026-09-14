import { describe, expect, it } from 'vitest';
import { goalSummary, simulatePlan } from './goals';
import { sampleData } from './sample';

describe('Phase 3 goals and scenarios', () => {
  it('keeps expected goal money separate from the confirmed shortfall', () => {
    const result = goalSummary(
      {
        id: 'g',
        name: 'Marriage',
        kind: 'MARRIAGE',
        targetDate: '2027-09-14',
        familyContribution: 100000,
        personalCash: 200000,
        engagement: 300000,
        travel: 400000,
        shopping: 500000,
        emergencyBuffer: 600000,
        otherAmount: 700000,
        alreadySaved: 200000,
        confirmedMoney: 300000,
        expectedMoney: 400000,
        notes: null,
      },
      '2026-09-14',
    );
    expect(result.total).toBe(2_800_000);
    expect(result.shortfall).toBe(2_300_000);
    expect(result.expectedShortfall).toBe(1_900_000);
    expect(result.requiredMonthly).toBe(Math.ceil(2_300_000 / 12));
  });

  it('models choices without mutating the source data', () => {
    const data = sampleData('2026-09-14'),
      before = data.accounts[0].balance;
    data.investments = [
      {
        id: 'i',
        name: 'SIP',
        kind: 'SIP',
        contributed: 0,
        currentValue: 0,
        monthlyContribution: 100000,
        nextContribution: null,
        maturityDate: null,
        liquid: false,
        notes: null,
      },
    ];
    const result = simulatePlan(
      data,
      {
        purchase: 500000,
        extraDebt: 200000,
        pauseInvestmentMonths: 3,
        receivable: 400000,
        receiveExpected: true,
        salaryDelayDays: 5,
      },
      '2026-09-14',
    );
    expect(result.cashAfter).toBe(result.cash);
    expect(result.debtAfter).toBe(result.debt - 200000);
    expect(result.salaryDelayed).toBe(true);
    expect(data.accounts[0].balance).toBe(before);
  });
});
