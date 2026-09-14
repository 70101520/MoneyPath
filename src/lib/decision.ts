import { addMonths, calculate, daysBetween, INR, localDay, today, type Data } from './finance';
import { spendingReport } from './planning';

export type ReservePlan = Pick<
  Data['settings'],
  'essentialReserve' | 'emergencyReserve' | 'goalReserve' | 'extraDebtReserve'
>;
export function salaryAllocation(
  data: Data,
  reserves: ReservePlan = data.settings,
  asOf = today(),
) {
  const result = calculate({ ...data, settings: { ...data.settings, ...reserves } }, asOf);
  const categories = [...new Set(data.commitments.filter((c) => c.active).map((c) => c.category))];
  return {
    ...result,
    groups: categories.map((category) => ({
      category,
      amount: calculate(
        { ...data, commitments: data.commitments.filter((c) => c.category === category) },
        asOf,
      ).commitmentReserve,
    })),
  };
}

export function paymentPriority(data: Data, asOf = today()) {
  const s = calculate(data, asOf);
  const ranked = s.obligations
    .filter((o) => o.amount > 0)
    .map((o) => {
      const card = data.cards.find((c) => c.id === o.id.split(':')[0]);
      const commitment = data.commitments.find((c) => c.id === o.id.split(':')[0]);
      const lateFee = card?.lateFee ?? commitment?.lateFee ?? null;
      const insurance = ['LIC', 'Term Insurance'].includes(o.kind);
      const score =
        (o.days < 0 ? 1000 : o.days <= 3 ? 500 : o.days <= 7 ? 300 : 0) +
        (insurance ? 90 : 0) +
        (o.essential ? 60 : 0) +
        (card ? 50 + card.interestBps / 100 : 0) +
        Math.min(100, (lateFee ?? 0) / 10000);
      const dueInHorizon = !!s.horizon && o.date <= s.horizon;
      // Each amount is evaluated against all other reserves. Never spend food/emergency cash.
      const headroom =
        s.safe.raw === null ? null : Math.max(0, s.safe.raw + (dueInHorizon ? o.amount : 0));
      const payable = headroom === null ? null : Math.min(o.amount, headroom, s.cash);
      const reasons = [
        o.days < 0 ? 'Overdue' : `Due in ${o.days} day(s)`,
        ...(insurance ? ['Insurance continuity'] : []),
        ...(o.essential ? ['Essential obligation'] : []),
        ...(card
          ? [
              `Recorded annual card rate ${(card.interestBps / 100).toFixed(2)}%; minimum due is not full settlement`,
            ]
          : []),
        lateFee === null
          ? 'Information Required: potential late fee is unknown; no fee amount is assumed'
          : `Recorded potential late fee ${INR(lateFee)}; this is a priority factor, not a posted expense`,
      ];
      const canRecord = !commitment || commitment.dueDate.slice(0, 10) === o.date;
      if (!canRecord)
        reasons.push('Settle the earlier unpaid occurrence before recording this payment.');
      return {
        ...o,
        score,
        payable,
        reasons,
        canRecord,
        withinHorizon: dueInHorizon,
        lateFee,
        target: card ? ('CARD' as const) : commitment ? ('COMMITMENT' as const) : null,
        action:
          payable === null
            ? 'Information Required'
            : o.kind === 'EMI reserve' || !dueInHorizon
              ? 'Reserve now'
              : payable < o.amount
                ? 'Funding shortfall'
                : o.days <= 3
                  ? 'Pay now'
                  : 'Next',
      };
    });
  return {
    ...s,
    ranked: ranked.sort(
      (a, b) =>
        Number(b.withinHorizon) - Number(a.withinHorizon) ||
        b.score - a.score ||
        a.date.localeCompare(b.date) ||
        a.id.localeCompare(b.id),
    ),
  };
}

export type PurchaseInput = {
  item: string;
  price: number;
  method: 'CASH' | 'CARD';
  essentiality: 'MUST HAVE' | 'IMPORTANT/FLEXIBLE' | 'WANT';
  category?: string;
  accountId?: string;
  cardId?: string;
};
export function simulatePurchase(data: Data, input: PurchaseInput, asOf = today()) {
  if (
    !input.item.trim() ||
    !Number.isSafeInteger(input.price) ||
    input.price <= 0 ||
    input.price > 1_000_000_000
  )
    throw new Error('Enter an item and a valid positive price');
  const before = calculate(data, asOf);
  const reasons: string[] = [];
  if (before.safe.raw === null)
    return {
      label: 'Information Required',
      level: 0,
      reasons: before.required,
      before,
      after: null,
      cashAfter: null,
      debtAfter: null,
      utilization: null,
    };
  const copy = structuredClone(data);
  let cashAfter = before.cash,
    debtAfter = before.debt,
    utilization: number | null = null;
  let level = 1;
  if (input.method === 'CASH') {
    const account = copy.accounts.find((a) => a.id === input.accountId && a.spendable);
    if (!account) throw new Error('Choose a spendable funding account');
    cashAfter -= input.price;
    if (input.price > account.balance) {
      reasons.push('The selected account cannot cover this purchase.');
      level = 4;
    }
    account.balance -= input.price;
  } else {
    const card = copy.cards.find((c) => c.id === input.cardId);
    if (!card) throw new Error('Choose a card');
    if (card.status !== 'ACTIVE') {
      level = 4;
      reasons.push('This card is not active.');
    }
    const emi = card.emis.reduce((n, e) => n + e.principalRemaining, 0);
    utilization = (card.outstanding + emi + input.price) / card.creditLimit;
    if (card.availableLimit === null)
      reasons.push('Information Required: issuer available limit is not reconciled.');
    if (utilization > 1 || (card.availableLimit !== null && input.price > card.availableLimit)) {
      level = 4;
      reasons.push('Purchase exceeds recorded card capacity.');
    } else if (utilization > 0.8) {
      level = Math.max(level, 3);
      reasons.push('Modeled card utilization would exceed 80%.');
    } else if (utilization > 0.5) {
      level = Math.max(level, 2);
      reasons.push('Modeled card utilization would exceed 50%.');
    }
    if (card.outstanding > 0 || emi > 0) {
      level = Math.max(level, 3);
      reasons.push('New borrowing would be added while card debt remains.');
    }
    card.outstanding += input.price;
    debtAfter += input.price;
    // Reserve repayment immediately, even if the new statement is after salary.
    copy.settings.extraDebtReserve = (copy.settings.extraDebtReserve ?? 0) + input.price;
    level = Math.max(level, 2);
    reasons.push(
      'Cash is unchanged today, but the full purchase is reserved for repayment. Credit limit is not income.',
    );
  }
  copy.expenses.push({
    id: 'purchase-preview',
    amount: input.price,
    date: asOf,
    category: input.category ?? 'Other',
    method: input.method === 'CARD' ? 'Credit Card' : 'Bank Transfer',
    essentiality: input.essentiality,
    accountId: input.method === 'CASH' ? input.accountId! : null,
    cardId: input.method === 'CARD' ? input.cardId! : null,
    description: null,
  });
  const after = calculate(copy, asOf);
  if (input.price > before.safe.available!) {
    level = 4;
    reasons.push(
      `Price exceeds safe-to-spend cash of ${INR(before.safe.available!)} after existing reservations.`,
    );
  } else if (after.safe.available! < 300000) {
    level = Math.max(level, 2);
    reasons.push('Less than ₹3,000 would remain safely spendable.');
  }
  if (input.essentiality === 'WANT' && before.risk.score! > 50) {
    level = Math.max(level, 3);
    reasons.push('An optional purchase adds pressure while the current risk score is high.');
  }
  reasons.push(
    `Cash ${INR(before.cash)}; mandatory reservations ${INR(before.mandatory)}; salary horizon ${before.horizon}.`,
  );
  if (level === 1)
    reasons.push(
      'The selected account covers the price while preserving recorded obligations and reserves.',
    );
  return {
    label: [
      '',
      'Green · Safe within recorded plan',
      'Yellow · Caution',
      'Orange · High risk',
      'Red · Do not recommend',
    ][level],
    level,
    reasons,
    before,
    after,
    cashAfter,
    debtAfter,
    utilization,
  };
}

export type DebtAssumption = {
  cardId: string;
  annualRateBps: number;
  minimum: number;
  rank: number;
};
export type DebtStrategy = 'AVALANCHE' | 'SNOWBALL' | 'CUSTOM';
export function debtForecast(
  data: Data,
  monthlyPayment: number,
  strategy: DebtStrategy,
  assumptions: DebtAssumption[],
  asOf = today(),
) {
  const debts = data.cards
    .map((c) => ({
      id: c.id,
      name: c.name,
      balance: c.outstanding + c.emis.reduce((n, e) => n + e.principalRemaining, 0),
      assumption: assumptions.find((a) => a.cardId === c.id),
    }))
    .filter((c) => c.balance > 0);
  const total = debts.reduce((n, c) => n + c.balance, 0);
  const missing = debts
    .filter((c) => !c.assumption)
    .map((c) => `${c.name}: enter forecast APR, minimum and priority`);
  if (
    !Number.isSafeInteger(monthlyPayment) ||
    monthlyPayment <= 0 ||
    monthlyPayment > 1_000_000_000
  )
    missing.push('Enter a positive monthly payment');
  if (!['AVALANCHE', 'SNOWBALL', 'CUSTOM'].includes(strategy)) missing.push('Choose a strategy');
  if (
    new Set(assumptions.map((a) => a.cardId)).size !== assumptions.length ||
    new Set(assumptions.map((a) => a.rank)).size !== assumptions.length
  )
    missing.push('Cards and priorities must be unique');
  for (const a of assumptions)
    if (
      ![a.annualRateBps, a.minimum, a.rank].every(Number.isSafeInteger) ||
      a.annualRateBps < 0 ||
      a.annualRateBps > 10000 ||
      a.minimum < 0 ||
      a.minimum > 1_000_000_000 ||
      a.rank < 1 ||
      a.rank > 100
    )
      missing.push('Invalid forecast assumptions');
  const schedule: {
    month: string;
    payment: number;
    interest: number;
    balance: number;
    target: string;
  }[] = [];
  const payoff: { card: string; month: string }[] = [];
  if (missing.length)
    return {
      total,
      missing,
      schedule,
      payoff,
      interest: null,
      months: null,
      debtFree: null,
      reason: 'Information Required',
    };
  let interest = 0;
  for (let m = 1; m <= 600 && debts.some((d) => d.balance > 0); m++) {
    const month = addMonths(asOf, m).toISOString().slice(0, 7);
    let monthlyInterest = 0;
    const active = debts.filter((d) => d.balance > 0);
    for (const d of active) {
      const cost = Math.ceil((d.balance * d.assumption!.annualRateBps) / 120000);
      d.balance += cost;
      monthlyInterest += cost;
    }
    const minimums = active.reduce((n, d) => n + Math.min(d.balance, d.assumption!.minimum), 0);
    if (minimums > monthlyPayment)
      return {
        total,
        missing,
        schedule,
        payoff,
        interest: null,
        months: null,
        debtFree: null,
        reason: `Monthly payment is below modeled minimums of ${INR(minimums)}.`,
      };
    let left = monthlyPayment;
    for (const d of active) {
      const pay = Math.min(d.balance, d.assumption!.minimum);
      d.balance -= pay;
      left -= pay;
    }
    const order = active
      .filter((d) => d.balance > 0)
      .sort((a, b) =>
        strategy === 'AVALANCHE'
          ? b.assumption!.annualRateBps - a.assumption!.annualRateBps ||
            a.balance - b.balance ||
            a.id.localeCompare(b.id)
          : strategy === 'SNOWBALL'
            ? a.balance - b.balance || a.id.localeCompare(b.id)
            : a.assumption!.rank - b.assumption!.rank,
      );
    const target = order[0]?.name ?? 'Final minimum payments';
    for (const d of order) {
      const pay = Math.min(left, d.balance);
      d.balance -= pay;
      left -= pay;
    }
    for (const d of active) if (d.balance === 0) payoff.push({ card: d.name, month });
    interest += monthlyInterest;
    const balance = debts.reduce((n, d) => n + d.balance, 0);
    schedule.push({
      month,
      payment: monthlyPayment - left,
      interest: monthlyInterest,
      balance,
      target,
    });
    if (!Number.isSafeInteger(balance))
      return {
        total,
        missing,
        schedule,
        payoff,
        interest: null,
        months: null,
        debtFree: null,
        reason: 'Balance exceeds the supported projection range.',
      };
    if (balance > 0 && monthlyPayment <= monthlyInterest)
      return {
        total,
        missing,
        schedule,
        payoff,
        interest: null,
        months: null,
        debtFree: null,
        reason: 'Payment does not cover modeled interest; debt will not fall.',
      };
  }
  const unfinished = debts.some((d) => d.balance > 0);
  return {
    total,
    missing,
    schedule,
    payoff,
    interest: unfinished ? null : interest,
    months: unfinished ? null : schedule.length,
    debtFree: unfinished ? null : (schedule.at(-1)?.month ?? asOf.slice(0, 7)),
    reason: unfinished ? 'Not repaid within the 600-month projection limit.' : null,
  };
}

export function planningNotifications(data: Data, asOf = today()) {
  const s = calculate(data, asOf),
    report = spendingReport(data, asOf.slice(0, 7));
  const items: { id: string; title: string; detail: string; section: string }[] = [];
  for (const o of s.obligations.filter((o) => o.amount > 0 && o.days <= 7))
    items.push({
      id: o.id,
      title: `${o.name}: ${INR(o.amount)}`,
      detail: o.days < 0 ? `${-o.days} day(s) overdue.` : `Due in ${o.days} day(s).`,
      section: 'priority',
    });
  for (const b of report.rows.filter(
    (r) => r.variance && (r.variance.overBudget || (r.variance.percentage ?? 0) >= 90),
  ))
    items.push({
      id: `budget-${b.category}`,
      title: `${b.category}: ${b.variance!.overBudget ? 'over budget' : '90% or more used'}`,
      detail: `${INR(b.actual)} spent against ${INR(b.budget!)}.`,
      section: 'budgets',
    });
  if (s.safe.available !== null && s.safe.available < 300000)
    items.push({
      id: 'low-cash',
      title: 'Pause discretionary spending',
      detail: s.safe.shortfall
        ? `${INR(s.safe.shortfall)} shortfall against recorded reservations.`
        : `Only ${INR(s.safe.available)} safely spendable.`,
      section: 'salary-plan',
    });
  if (s.newSpending > s.debtPaid)
    items.push({
      id: 'debt-growing',
      title: 'New card debt exceeds repayments',
      detail: `${INR(s.newSpending - s.debtPaid)} net increase from recorded transactions this month.`,
      section: 'debt-plan',
    });
  const previousCard = data.expenses
    .filter((e) => e.cardId && e.date.slice(0, 7) === report.previousMonth)
    .reduce((n, e) => n + e.amount, 0);
  if (s.newSpending > previousCard && previousCard > 0)
    items.push({
      id: 'card-spending-increase',
      title: 'Card spending increased',
      detail: `${INR(s.newSpending - previousCard)} above recorded prior-month card spending; the current month is incomplete.`,
      section: 'spending',
    });
  for (const c of data.commitments.filter(
    (c) =>
      c.active &&
      c.intervalMonths > 1 &&
      daysBetween(asOf, c.dueDate) > 7 &&
      daysBetween(asOf, c.dueDate) <= 60,
  )) {
    const reserve = calculate({ ...data, commitments: [c] }, asOf).commitmentReserve;
    items.push({
      id: `reserve-${c.id}`,
      title: `${c.name}: reserve ahead`,
      detail: `${INR(c.amount - c.paid)} due ${c.dueDate.slice(0, 10)}. Current total earmark requirement ${INR(reserve)} including ${INR(c.funded)} already funded.`,
      section: 'commitments',
    });
  }
  if (s.required.length)
    items.unshift({
      id: 'missing',
      title: 'Information Required',
      detail: s.required.join(', '),
      section: 'settings',
    });
  return items;
}

export function historyReports(data: Data, endMonth = today().slice(0, 7)) {
  return Array.from({ length: 12 }, (_, i) => {
    const month = addMonths(`${endMonth}-01`, i - 11)
      .toISOString()
      .slice(0, 7);
    const spending = spendingReport(data, month);
    const received = data.incomes
      .filter(
        (r) => r.status === 'RECEIVED' && r.date.slice(0, 7) === month && r.accountId !== null,
      )
      .reduce((n, r) => n + r.amount, 0);
    const cashExpenses = data.expenses
      .filter((r) => r.date.slice(0, 7) === month && r.accountId !== null)
      .reduce((n, r) => n + r.amount, 0);
    // Commitment expenses already exist in Expense; only card repayments are additional cash outflows.
    const cashOut = cashExpenses + spending.debtPayments;
    const snapshots = (data.risks ?? []).filter((r) => localDay(r.createdAt).slice(0, 7) === month);
    const latest = snapshots[0];
    return {
      ...spending,
      cashIn: received,
      cashOut,
      netCashFlow: received - cashOut,
      netDebtReduction: spending.debtPayments - spending.cardSpending,
      score: latest?.score ?? null,
      version: latest?.version ?? null,
      metrics: latest?.metrics ?? null,
      snapshotDate: latest?.createdAt ?? null,
      budgetOverruns: spending.rows.filter((r) => r.variance?.overBudget).length,
    };
  });
}
