import { addMonths, budgetVariance, type Data } from './finance';

export const categoryKey = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();

// Reports reflect recorded transactions only. Payments are never added to expenses.
export function spendingReport(data: Data, month: string) {
  if (!/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Invalid month');
  const previousMonth = addMonths(`${month}-01`, -1).toISOString().slice(0, 7);
  const current = data.expenses.filter((e) => e.date.slice(0, 7) === month);
  const previous = data.expenses.filter((e) => e.date.slice(0, 7) === previousMonth);
  const budgets = (data.budgets ?? []).filter((b) => b.month === month);
  const keys = new Set([...current, ...previous, ...budgets].map((e) => categoryKey(e.category)));
  const sum = (rows: { amount: number }[]) => rows.reduce((n, r) => n + r.amount, 0);
  const rows = [...keys]
    .map((category) => {
      const actual = sum(current.filter((e) => categoryKey(e.category) === category));
      const prior = sum(previous.filter((e) => categoryKey(e.category) === category));
      const budget = budgets.find((b) => categoryKey(b.category) === category)?.amount ?? null;
      return {
        category,
        actual,
        prior,
        change: actual - prior,
        budget,
        variance: budget === null ? null : budgetVariance(budget, actual),
      };
    })
    .sort((a, b) => b.actual - a.actual || a.category.localeCompare(b.category));
  const payments = data.payments.filter((p) => p.date.slice(0, 7) === month);
  const total = sum(current),
    priorTotal = sum(previous);
  return {
    month,
    previousMonth,
    rows,
    total,
    priorTotal,
    change: total - priorTotal,
    percentageChange: priorTotal === 0 ? null : ((total - priorTotal) * 100) / priorTotal,
    income: sum(
      data.incomes.filter((i) => i.date.slice(0, 7) === month && i.status === 'RECEIVED'),
    ),
    wants: sum(current.filter((e) => e.essentiality === 'WANT')),
    priorWants: sum(previous.filter((e) => e.essentiality === 'WANT')),
    essential: sum(current.filter((e) => e.essentiality === 'MUST HAVE')),
    flexible: sum(current.filter((e) => e.essentiality === 'IMPORTANT/FLEXIBLE')),
    family: sum(
      current.filter((e) => ['family', 'family support'].includes(categoryKey(e.category))),
    ),
    cardSpending: sum(current.filter((e) => e.cardId !== null)),
    debtPayments: sum(payments.filter((p) => p.cardId !== null)),
    investmentTransfers: sum(
      payments.filter(
        (p) =>
          p.commitmentId !== null &&
          data.commitments.some(
            (c) => c.id === p.commitmentId && ['SIP', 'Gold Saving Plan'].includes(c.category),
          ),
      ),
    ),
    totalBudget: sum(budgets),
    unbudgeted: sum(rows.filter((r) => r.budget === null).map((r) => ({ amount: r.actual }))),
  };
}
