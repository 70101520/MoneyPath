import { calculate, INR, type Data } from './finance';
import { paymentPriority } from './decision';
import { spendingReport } from './planning';
import { goalSummary } from './goals';

export type GuidanceAction = {
  level: 'NOW' | 'NEXT' | 'WATCH' | 'GOOD';
  title: string;
  detail: string;
  section: string;
};

export function financialActionPlan(data: Data): { headline: string; actions: GuidanceAction[] } {
  const summary = calculate(data),
    actions: GuidanceAction[] = [];
  if (summary.required.length)
    return {
      headline: 'Information Required',
      actions: [
        {
          level: 'NOW',
          title: 'Complete your financial setup',
          detail: `Add ${summary.required.join(', ')}. Guidance will not guess missing money.`,
          section: 'settings',
        },
      ],
    };
  const priorities = paymentPriority(data).ranked;
  for (const item of priorities.filter((p) => p.withinHorizon).slice(0, 3))
    actions.push({
      level: item.days <= 3 ? 'NOW' : 'NEXT',
      title: `${item.action}: ${item.name}`,
      detail: `${INR(item.amount)} due ${item.date}. ${item.payable !== null && item.payable < item.amount ? `Only ${INR(item.payable)} can be paid while protecting other recorded needs.` : 'Recorded cash can cover this while current reservations remain protected.'}`,
      section: 'priority',
    });
  const report = spendingReport(data, summary.asOf.slice(0, 7)),
    over = report.rows.filter((r) => r.variance?.overBudget);
  if (over.length)
    actions.push({
      level: 'NOW',
      title: 'Stop or reduce over-budget categories',
      detail: over
        .slice(0, 3)
        .map((r) => `${r.category}: ${INR(r.actual - r.budget!)} over`)
        .join(' · '),
      section: 'budgets',
    });
  if (summary.safe.shortfall || summary.safe.available! < 300000) {
    const investments = (data.investments ?? [])
      .filter((i) => i.monthlyContribution > 0)
      .map((i) => i.name);
    actions.push({
      level: 'NOW',
      title: 'Pause optional spending',
      detail: summary.safe.shortfall
        ? `Recorded plan is short by ${INR(summary.safe.shortfall)}. Review goal allocation and optional investment contributions${investments.length ? ` (${investments.slice(0, 3).join(', ')})` : ''}; do not skip essentials or card minimums.`
        : `Only ${INR(summary.safe.available!)} is safely spendable. Keep wants on hold until the next salary or plan update.`,
      section: 'salary-plan',
    });
  } else
    actions.push({
      level: 'GOOD',
      title: `Keep spending within ${INR(summary.safe.available!)}`,
      detail:
        'This is the current maximum after recorded bills, living needs, emergency money, debt and goals. Recheck after every entry.',
      section: 'dashboard',
    });
  if (summary.debt > 0)
    actions.push({
      level: 'WATCH',
      title: 'Avoid new credit-card spending',
      detail: `Recorded card debt is ${INR(summary.debt)}. Pay required bills first, then use only the extra-debt amount approved by the salary plan.`,
      section: 'debt-plan',
    });
  const goal = (data.goals ?? [])[0];
  if (goal) {
    const g = goalSummary(goal, summary.asOf);
    actions.push({
      level: 'NEXT',
      title: `Fund ${goal.name} steadily`,
      detail: `Confirmed shortfall ${INR(g.shortfall)}; target about ${INR(g.requiredMonthly)} per month. Expected money remains separate until received.`,
      section: 'goals',
    });
  }
  return {
    headline: summary.safe.shortfall
      ? 'Cash plan needs adjustment'
      : priorities.some((p) => p.days <= 3)
        ? 'Pay urgent items first'
        : 'Your next money actions',
    actions,
  };
}

export function emergencyAdjustment(data: Data, amount: number) {
  const summary = calculate(data);
  if (!Number.isSafeInteger(amount) || amount <= 0)
    return { title: 'Enter an emergency amount', steps: [] as string[], uncovered: 0 };
  if (summary.required.length)
    return {
      title: 'Information Required',
      steps: [`Complete ${summary.required.join(', ')} first.`],
      uncovered: amount,
    };
  let left = amount;
  const steps: string[] = [];
  const take = (label: string, available: number) => {
    const used = Math.min(left, Math.max(0, available));
    if (used) {
      steps.push(`Use ${INR(used)} from ${label}.`);
      left -= used;
    }
  };
  take('the emergency reserve', data.settings.emergencyReserve ?? 0);
  take('current safe-to-spend money', summary.safe.available ?? 0);
  take('optional investment contributions due before salary', summary.investmentReserve);
  take('the goal earmark after reviewing the goal date', data.settings.goalReserve ?? 0);
  if (left > 0)
    steps.push(
      `${INR(left)} remains uncovered. Delay optional purchases, reduce the emergency cost if possible, or arrange additional income. Compare borrowing only after checking total repayment and due dates.`,
    );
  return {
    title: left ? 'Emergency is not fully funded' : 'Emergency can be adjusted from recorded cash',
    steps,
    uncovered: left,
  };
}
