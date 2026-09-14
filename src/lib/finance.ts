// All authoritative amounts are integer paise. No floating point currency math.
export const INR = (paise: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: paise % 100 ? 2 : 0,
  }).format(paise / 100);
export const dateLabel = (date: string | Date) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
    .format(new Date(date))
    .replaceAll('/', '-');
export function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}
export function localDay(value: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(value));
}
export function day(value: string | Date) {
  return new Date(
    typeof value === 'string'
      ? value.slice(0, 10) + 'T00:00:00.000Z'
      : value.toISOString().slice(0, 10) + 'T00:00:00.000Z',
  );
}
export function daysBetween(a: string | Date, b: string | Date) {
  return Math.round((day(b).getTime() - day(a).getTime()) / 86400000);
}
export function addMonths(value: string | Date, months: number, anchor = day(value).getUTCDate()) {
  const d = day(value);
  const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(anchor, last));
  return first;
}
export function nextSalary(asOf: string, salaryDay: number) {
  const d = day(asOf);
  const candidate = addMonths(
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)),
    0,
    salaryDay,
  );
  return candidate > d ? candidate : addMonths(candidate, 1, salaryDay);
}
export function monthlyReserve(amount: number, intervalMonths: number) {
  if (!Number.isInteger(intervalMonths) || intervalMonths < 1 || amount < 0)
    throw new Error('Invalid reserve inputs');
  return Math.ceil(amount / intervalMonths);
}
export function statementBalance(amount: number, paid: number) {
  if (paid < 0 || amount < 0 || paid > amount)
    throw new Error('Statement payments exceed statement amount');
  return amount - paid;
}
export function unbilledSpending(outstanding: number, statementRemaining: number) {
  if (outstanding < statementRemaining)
    throw new Error('Information Required: outstanding is below the remaining statement');
  return outstanding - statementRemaining;
}
export function cardPayment(
  card: { outstanding: number; statementAmount: number; statementPaid: number },
  amount: number,
  type: string,
  cash: number,
) {
  const remaining = statementBalance(card.statementAmount, card.statementPaid);
  if (amount <= 0 || amount > cash || amount > card.outstanding)
    throw new Error('Payment exceeds available cash or posted debt');
  if (type === 'STATEMENT' && amount > remaining)
    throw new Error('Payment exceeds remaining statement');
  if (type === 'UNBILLED' && amount > card.outstanding - remaining)
    throw new Error('Payment exceeds unbilled debt');
  if (!['STATEMENT', 'UNBILLED'].includes(type)) throw new Error('Invalid card payment type');
  return {
    outstanding: card.outstanding - amount,
    statementPaid: card.statementPaid + (type === 'STATEMENT' ? amount : 0),
    cash: cash - amount,
    expense: 0,
  };
}
export function postEmi(principalRemaining: number, principal: number, interest: number) {
  if (principal <= 0 || principal > principalRemaining || interest < 0)
    throw new Error('Invalid EMI components');
  return {
    principalRemaining: principalRemaining - principal,
    outstandingIncrease: principal + interest,
    expense: interest,
    newDebt: interest,
  };
}
export function safeToSpend(cash: number | null, reservations: (number | null)[]) {
  if (cash === null || reservations.some((v) => v === null))
    return { available: null, shortfall: null, raw: null };
  const raw = cash - (reservations as number[]).reduce((a, b) => a + b, 0);
  return { available: Math.max(0, raw), shortfall: Math.max(0, -raw), raw };
}
export function budgetVariance(budget: number, actual: number) {
  return {
    difference: budget - actual,
    percentage: budget === 0 ? (actual === 0 ? 0 : null) : (actual * 100) / budget,
    overBudget: actual > budget,
  };
}
export function debtReduction(paid: number, newDebt: number) {
  return paid - newDebt;
}
export function goalShortfall(
  required: number,
  saved: number,
  confirmed: number,
  _expected: number,
) {
  return Math.max(0, required - saved - confirmed);
}

export type Settings = {
  name: string;
  salaryDay: number | null;
  monthlyIncome: number | null;
  essentialReserve: number | null;
  emergencyReserve: number | null;
  goalReserve: number | null;
  extraDebtReserve: number | null;
};
export type AccountData = {
  id: string;
  name: string;
  kind: string;
  balance: number;
  spendable: boolean;
};
export type EmiData = {
  id: string;
  cardId: string;
  name: string;
  originalAmount: number;
  principalRemaining: number;
  monthlyEmi: number;
  nextPrincipal: number;
  nextInterest: number;
  totalInstallments: number;
  installmentsPaid: number;
  nextDate: string;
  anchorDay: number;
};
export type CardData = {
  id: string;
  bank: string;
  name: string;
  lastFour: string | null;
  creditLimit: number;
  availableLimit: number | null;
  outstanding: number;
  statementAmount: number;
  statementPaid: number;
  carriedBalance?: number;
  carriedDueDate?: string | null;
  statementDate: string;
  dueDate: string;
  minimumDue: number;
  interestBps: number;
  lateFee?: number | null;
  status: string;
  emis: EmiData[];
  statements?: {
    id: string;
    amount: number;
    paid: number;
    statementDate: string;
    dueDate: string;
  }[];
};
export type CommitmentData = {
  lateFee?: number | null;
  id: string;
  name: string;
  category: string;
  amount: number;
  intervalMonths: number;
  dueDate: string;
  anchorDay: number;
  funded: number;
  paid: number;
  essential: boolean;
  active: boolean;
};
export type ExpenseData = {
  id: string;
  amount: number;
  date: string;
  category: string;
  method: string;
  description: string | null;
  essentiality: string;
  cardId: string | null;
  accountId: string | null;
};
export type IncomeData = {
  id: string;
  amount: number;
  date: string;
  source: string;
  status: string;
  recurring: boolean;
  notes: string | null;
  accountId: string | null;
};
export type PaymentData = {
  id: string;
  amount: number;
  date: string;
  type: string;
  accountId: string;
  cardId: string | null;
  commitmentId: string | null;
  notes: string | null;
};
export type Data = {
  revision?: string;
  salaryPlans?: {
    id: string;
    incomeId: string;
    essentialReserve: number;
    emergencyReserve: number;
    goalReserve: number;
    extraDebtReserve: number;
    cashAtAcceptance: number;
    mandatoryAtAcceptance: number;
    acceptedAt: string;
  }[];
  debtPlan?: {
    monthlyPayment: number;
    strategy: 'AVALANCHE' | 'SNOWBALL' | 'CUSTOM';
    assumptions: { cardId: string; annualRateBps: number; minimum: number; rank: number }[];
  } | null;
  risks?: {
    id: string;
    score: number | null;
    version: string;
    createdAt: string;
    rules: RiskRule[];
    metrics: { cash: number; debt: number; assets: number; netWorth: number } | null;
  }[];
  budgets?: { id: string; month: string; category: string; amount: number }[];
  settings: Settings;
  accounts: AccountData[];
  cards: CardData[];
  commitments: CommitmentData[];
  expenses: ExpenseData[];
  incomes: IncomeData[];
  payments: PaymentData[];
};
export type Obligation = {
  id: string;
  name: string;
  kind: string;
  amount: number;
  date: string;
  essential: boolean;
  days: number;
};
export type RiskRule = { id: string; points: number; reason: string };
export function emiOccurrences(e: EmiData, through: string): { date: string; amount: number }[] {
  const result: { date: string; amount: number }[] = [];
  let due = day(e.nextDate);
  for (let i = 0; i < e.totalInstallments - e.installmentsPaid && due <= day(through); i++) {
    result.push({ date: due.toISOString().slice(0, 10), amount: e.monthlyEmi });
    due = addMonths(due, 1, e.anchorDay);
  }
  return result;
}
export function riskScore(input: {
  income: number | null;
  debt: number;
  oldBill: number;
  newSpending: number;
  utilization: number | null;
  overdue: boolean;
  monthlyCommitments: number;
  emergency: number | null;
  essentials: number | null;
  raw: number | null;
}) {
  const rules: RiskRule[] = [];
  const add = (id: string, points: number, reason: string) => rules.push({ id, points, reason });
  if (
    input.income === null ||
    input.emergency === null ||
    input.essentials === null ||
    input.raw === null
  )
    return { score: null, label: 'Information Required', rules };
  if (input.debt > input.income) add('debt-income', 15, 'Card debt exceeds one month of income');
  if (input.newSpending > 0 && input.oldBill > 0)
    add('new-debt', 15, 'New card spending while an old bill remains');
  if (input.utilization !== null && input.utilization > 0.5)
    add(
      'utilization',
      input.utilization > 0.8 ? 20 : 10,
      'Credit utilization is above ' + (input.utilization > 0.8 ? '80%' : '50%'),
    );
  if (input.overdue) add('overdue', 20, 'You have overdue payments');
  if (input.monthlyCommitments > input.income * 0.6)
    add('commitments', 10, 'Mandatory payments exceed 60% of monthly income');
  if (input.emergency < input.essentials)
    add('emergency', 10, 'Emergency reserve is below one month of essentials');
  if (input.raw < 0) add('shortfall', 15, 'Cash does not cover your reservations');
  else if (input.raw < 300000) add('low-cash', 5, 'Safe to spend is below ₹3,000');
  const score = Math.min(
    100,
    rules.reduce((sum, r) => sum + r.points, 0),
  );
  return {
    score,
    label:
      score <= 30 ? 'Low risk' : score <= 50 ? 'Moderate' : score <= 70 ? 'High risk' : 'Critical',
    rules,
  };
}
export function calculate(data: Data, asOf = today()) {
  const { settings: s } = data;
  const horizon =
    s.salaryDay === null ? null : nextSalary(asOf, s.salaryDay).toISOString().slice(0, 10);
  const cash = data.accounts.filter((a) => a.spendable).reduce((sum, a) => sum + a.balance, 0);
  const month = asOf.slice(0, 7);
  const expenses = data.expenses.filter(
    (e) => e.date.slice(0, 7) === month && e.date.slice(0, 10) <= asOf,
  );
  const income = data.incomes
    .filter((i) => i.status === 'RECEIVED' && i.date.slice(0, 7) === month)
    .reduce((sum, i) => sum + i.amount, 0);
  const obligations: Obligation[] = [];
  let commitmentReserve = 0;
  for (const c of data.commitments.filter((c) => c.active)) {
    let due = day(c.dueDate);
    let first = true;
    let reserve = 0;
    // Expand each unpaid recurrence through salary; never discard missed periods.
    for (let count = 0; count < 2400 && (!horizon ? first : due <= day(horizon)); count++) {
      const remaining = c.amount - (first ? c.paid : 0);
      if (remaining > 0)
        obligations.push({
          id: c.id + ':' + due.toISOString(),
          name: c.name,
          kind: c.category,
          amount: remaining,
          date: due.toISOString().slice(0, 10),
          essential: c.essential,
          days: daysBetween(asOf, due),
        });
      reserve += remaining;
      due = addMonths(due, c.intervalMonths, c.anchorDay);
      first = false;
    }
    // Long-cycle sinking funds: money already earmarked plus this month's catch-up.
    if (first) {
      const monthsLeft = Math.max(1, Math.ceil(daysBetween(asOf, c.dueDate) / 30.4375));
      const accrual =
        c.intervalMonths > 1
          ? Math.min(
              c.amount - c.paid - c.funded,
              Math.max(
                monthlyReserve(c.amount, c.intervalMonths),
                Math.ceil((c.amount - c.paid - c.funded) / monthsLeft),
              ),
            )
          : 0;
      reserve = c.funded + Math.max(0, accrual);
      obligations.push({
        id: c.id,
        name: c.name,
        kind: c.category,
        amount: c.amount - c.paid,
        date: c.dueDate.slice(0, 10),
        essential: c.essential,
        days: daysBetween(asOf, c.dueDate),
      });
    }
    commitmentReserve += reserve;
  }
  let cardReserve = 0,
    emiReserve = 0,
    debt = 0,
    oldBill = 0,
    totalLimit = 0;
  const issues: string[] = [];
  for (const c of data.cards) {
    const remaining = statementBalance(c.statementAmount, c.statementPaid);
    oldBill += remaining;
    totalLimit += c.creditLimit;
    debt += c.outstanding + c.emis.reduce((sum, e) => sum + e.principalRemaining, 0);
    if (c.outstanding < remaining) issues.push(c.name + ': reconcile statement and outstanding');
    const carried = c.carriedBalance ?? 0;
    if (carried > 0 && c.carriedDueDate) {
      obligations.push({
        id: c.id + ':carried',
        name: c.name + ' · carried balance',
        kind: 'Credit card',
        amount: carried,
        date: c.carriedDueDate.slice(0, 10),
        essential: true,
        days: daysBetween(asOf, c.carriedDueDate),
      });
      if (horizon && c.carriedDueDate.slice(0, 10) <= horizon) cardReserve += carried;
    }
    if (remaining - carried > 0) {
      obligations.push({
        id: c.id,
        name: c.name,
        kind: 'Credit card',
        amount: remaining - carried,
        date: c.dueDate.slice(0, 10),
        essential: true,
        days: daysBetween(asOf, c.dueDate),
      });
      if (horizon && c.dueDate.slice(0, 10) <= horizon) cardReserve += remaining - carried;
    }
    for (const e of c.emis.filter((e) => e.principalRemaining > 0)) {
      const occurrences = horizon ? emiOccurrences(e, horizon) : [];
      if (!occurrences.length)
        obligations.push({
          id: e.id,
          name: e.name,
          kind: 'EMI reserve',
          amount: e.monthlyEmi,
          date: e.nextDate.slice(0, 10),
          essential: true,
          days: daysBetween(asOf, e.nextDate),
        });
      for (const occurrence of occurrences) {
        obligations.push({
          id: e.id + ':' + occurrence.date,
          name: e.name,
          kind: 'EMI reserve',
          amount: occurrence.amount,
          date: occurrence.date,
          essential: true,
          days: daysBetween(asOf, occurrence.date),
        });
        emiReserve += occurrence.amount;
      }
      if (e.nextPrincipal + e.nextInterest === 0)
        issues.push(e.name + ': enter next EMI principal and interest');
    }
  }
  const required: string[] = (
    [
      'salaryDay',
      'monthlyIncome',
      'essentialReserve',
      'emergencyReserve',
      'goalReserve',
      'extraDebtReserve',
    ] as const
  ).filter((k) => s[k] === null);
  if (!data.accounts.length) required.push('bank account opening balance');
  required.push(...issues);
  const mandatory = commitmentReserve + cardReserve + emiReserve;
  const safe = safeToSpend(required.length ? null : cash, [
    mandatory,
    s.essentialReserve,
    s.emergencyReserve,
    s.goalReserve,
    s.extraDebtReserve,
  ]);
  const newSpending = expenses.filter((e) => e.cardId).reduce((sum, e) => sum + e.amount, 0);
  const debtPaid = data.payments
    .filter((p) => p.cardId && p.date.slice(0, 7) === month)
    .reduce((sum, p) => sum + p.amount, 0);
  const monthlyCommitments = data.commitments
    .filter((c) => c.active && c.essential)
    .reduce((sum, c) => sum + monthlyReserve(c.amount, c.intervalMonths), 0);
  const risk = riskScore({
    income: s.monthlyIncome,
    debt,
    oldBill,
    newSpending,
    utilization: totalLimit ? debt / totalLimit : null,
    overdue: obligations.some((o) => o.days < 0),
    monthlyCommitments,
    emergency: s.emergencyReserve,
    essentials: s.essentialReserve,
    raw: safe.raw,
  });
  // v2 adds explainable rules only when the required recorded inputs exist.
  if (risk.score !== null) {
    const key = (v: string) => v.trim().replace(/\s+/g, ' ').toLowerCase();
    const budgets = (data.budgets ?? []).filter((b) => b.month === month);
    const over = budgets.filter(
      (b) =>
        expenses
          .filter((e) => key(e.category) === key(b.category))
          .reduce((n, e) => n + e.amount, 0) > b.amount,
    );
    if (over.length)
      risk.rules.push({
        id: 'budget-overrun',
        points: 10,
        reason: `Recorded spending exceeds ${over.length} category budget(s)`,
      });
    if (income > 0 && expenses.reduce((n, e) => n + e.amount, 0) > income)
      risk.rules.push({
        id: 'expenses-income',
        points: 10,
        reason: 'Recorded expenses exceed received income this month',
      });
    if (
      income > 0 &&
      expenses.filter((e) => e.accountId).reduce((n, e) => n + e.amount, 0) + debtPaid > income
    )
      risk.rules.push({
        id: 'negative-account-flow',
        points: 10,
        reason: 'Recorded account outflows exceed received income this month',
      });
    if (newSpending > debtPaid)
      risk.rules.push({
        id: 'new-debt-exceeds-payments',
        points: 10,
        reason: 'Recorded new card debt exceeds repayments this month',
      });
    else if (debtPaid > newSpending)
      risk.rules.push({
        id: 'debt-reduction',
        points: -5,
        reason: 'Recorded repayments exceed new card debt this month',
      });
    const prior = (data.risks ?? []).find(
      (r) => localDay(r.createdAt).slice(0, 7) < month && r.metrics !== null,
    );
    if (prior?.metrics && debt > prior.metrics.debt)
      risk.rules.push({
        id: 'debt-trend',
        points: 5,
        reason: 'Card debt is higher than the last recorded prior-month snapshot',
      });
    const transfers = data.payments
      .filter(
        (p) =>
          p.date.slice(0, 7) === month &&
          p.commitmentId &&
          data.commitments.some(
            (c) => c.id === p.commitmentId && ['SIP', 'Gold Saving Plan'].includes(c.category),
          ),
      )
      .reduce((n, p) => n + p.amount, 0);
    if (income > 0 && transfers === 0)
      risk.rules.push({
        id: 'no-investment-contribution',
        points: 5,
        reason:
          'No investment contribution recorded against received income this month; other savings may be unrecorded',
      });
    risk.score = Math.max(
      0,
      Math.min(
        100,
        risk.rules.reduce((n, r) => n + r.points, 0),
      ),
    );
    risk.label =
      risk.score <= 30
        ? 'Low risk'
        : risk.score <= 50
          ? 'Moderate'
          : risk.score <= 70
            ? 'High risk'
            : 'Critical';
  }
  const categories = Object.entries(
    expenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.amount;
      return acc;
    }, {}),
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  return {
    asOf,
    horizon,
    cash,
    income,
    expenseTotal: expenses.reduce((sum, e) => sum + e.amount, 0),
    debt,
    oldBill,
    newSpending,
    debtPaid,
    netDebtReduction: debtReduction(debtPaid, newSpending),
    mandatory,
    monthlyCommitments,
    commitmentReserve,
    cardReserve,
    emiReserve,
    safe,
    risk,
    riskVersion: 'planning-v2',
    required,
    categories,
    obligations: obligations.sort((a, b) => a.date.localeCompare(b.date)),
    nonSpendable: data.accounts.filter((a) => !a.spendable).reduce((sum, a) => sum + a.balance, 0),
  };
}
