import { day, daysBetween, type Data, type GoalData } from './finance';

export function goalSummary(goal: GoalData, asOf: string) {
  const total =
    goal.familyContribution +
    goal.personalCash +
    goal.engagement +
    goal.travel +
    goal.shopping +
    goal.emergencyBuffer +
    goal.otherAmount;
  const confirmed = goal.alreadySaved + goal.confirmedMoney;
  const shortfall = Math.max(0, total - confirmed);
  const days = Math.max(0, daysBetween(asOf, goal.targetDate));
  const monthsRemaining = Math.max(1, Math.ceil(days / 30.4375));
  return {
    total,
    confirmed,
    expected: goal.expectedMoney,
    shortfall,
    monthsRemaining,
    requiredMonthly: Math.ceil(shortfall / monthsRemaining),
    expectedShortfall: Math.max(0, shortfall - goal.expectedMoney),
  };
}

export type Scenario = {
  purchase?: number;
  extraDebt?: number;
  pauseInvestmentMonths?: number;
  receivable?: number;
  receiveExpected?: boolean;
  salaryDelayDays?: number;
};
export function simulatePlan(data: Data, scenario: Scenario, asOf: string) {
  const cash = data.accounts.filter((a) => a.spendable).reduce((n, a) => n + a.balance, 0);
  const debt =
    data.cards.reduce(
      (n, c) => n + c.outstanding + c.emis.reduce((x, e) => x + e.principalRemaining, 0),
      0,
    ) +
    (data.personalEntries ?? [])
      .filter((e) => e.direction === 'PAYABLE')
      .reduce((n, e) => n + e.amount - e.settled, 0);
  const paused = (data.investments ?? []).reduce(
    (n, i) => n + i.monthlyContribution * (scenario.pauseInvestmentMonths ?? 0),
    0,
  );
  const receipt = scenario.receiveExpected ? (scenario.receivable ?? 0) : 0;
  const cashAfter = cash - (scenario.purchase ?? 0) - (scenario.extraDebt ?? 0) + paused + receipt;
  const debtAfter = Math.max(0, debt - (scenario.extraDebt ?? 0));
  const salaryDelayed = (scenario.salaryDelayDays ?? 0) > 0;
  return {
    cash,
    cashAfter,
    debt,
    debtAfter,
    paused,
    receipt,
    salaryDelayed,
    asOf: day(asOf).toISOString().slice(0, 10),
  };
}
