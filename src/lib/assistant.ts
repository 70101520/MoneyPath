import { calculate, INR, type Data } from './finance';
import { paymentPriority } from './decision';
import { spendingReport } from './planning';
import { goalSummary } from './goals';

export type AssistantIntent = 'SPEND' | 'PAY' | 'RISK' | 'OVERSPEND' | 'GOAL';
export function explainFinance(data: Data, intent: AssistantIntent, amount = 0) {
  const s = calculate(data);
  if (s.required.length)
    return {
      title: 'Information Required',
      answer: `Complete ${s.required.join(', ')} before relying on this answer.`,
      facts: [],
    };
  if (intent === 'SPEND')
    return {
      title:
        amount <= (s.safe.available ?? 0)
          ? 'Inside the recorded limit'
          : 'Above your safe-to-spend amount',
      answer:
        amount <= (s.safe.available ?? 0)
          ? `${INR(amount)} fits inside the current ${INR(s.safe.available!)} safe-to-spend balance.`
          : `${INR(amount)} is ${INR(amount - s.safe.available!)} above the current safe-to-spend balance.`,
      facts: [
        `Cash ${INR(s.cash)}`,
        `Mandatory and planned reservations ${INR(s.cash - s.safe.raw!)}`,
      ],
    };
  if (intent === 'PAY') {
    const first = paymentPriority(data).ranked[0];
    return first
      ? {
          title: first.action,
          answer: `${first.name}: ${INR(first.amount)}, due ${first.date}.`,
          facts: [
            `Priority score ${first.score}`,
            `Safe to spend after recorded reservations ${INR(s.safe.available!)}`,
          ],
        }
      : {
          title: 'Nothing due',
          answer: 'No unpaid recorded obligation is currently ranked.',
          facts: [],
        };
  }
  if (intent === 'RISK')
    return {
      title: `${s.risk.score}/100 · ${s.risk.label}`,
      answer: s.risk.rules.length
        ? s.risk.rules.map((r) => `${r.points >= 0 ? '+' : ''}${r.points}: ${r.reason}`).join(' ')
        : 'No risk rule is currently triggered.',
      facts: [`Total recorded debt ${INR(s.totalDebt)}`, `Safe to spend ${INR(s.safe.available!)}`],
    };
  if (intent === 'OVERSPEND') {
    const report = spendingReport(data, s.asOf.slice(0, 7));
    const rows = report.rows.filter((r) => r.variance?.overBudget);
    return {
      title: rows.length ? 'Budget pressure found' : 'No recorded budget overrun',
      answer: rows.length
        ? rows.map((r) => `${r.category}: ${INR(r.actual)} against ${INR(r.budget!)}`).join('. ')
        : 'No category with a recorded budget is over its limit.',
      facts: [`Recorded spending ${INR(report.total)}`],
    };
  }
  const goal = (data.goals ?? [])[0];
  if (!goal)
    return {
      title: 'Information Required',
      answer: 'Add a marriage or other goal first.',
      facts: [],
    };
  const g = goalSummary(goal, s.asOf);
  return {
    title: goal.name,
    answer: `The confirmed shortfall is ${INR(g.shortfall)} across ${g.monthsRemaining} month(s), requiring about ${INR(g.requiredMonthly)} per month.`,
    facts: [
      `Expected money shown separately ${INR(g.expected)}`,
      `Shortfall if it arrives ${INR(g.expectedShortfall)}`,
    ],
  };
}
