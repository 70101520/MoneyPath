import { calculate, INR, today, type Data } from './finance';
import { financialActionPlan, emergencyAdjustment } from './guidance';
import { paymentPriority } from './decision';
import type { Command } from './validation';

export type ChatContext = { accountId?: string; cardId?: string };
export type ChatReply = {
  answer: string;
  details: string[];
  draft?: Command;
  confirmation?: string;
};

export function parseAmount(message: string) {
  const matches = [
    ...message
      .toLowerCase()
      .matchAll(/(?:₹|rs\.?\s*)?([\d,]+(?:\.\d{1,2})?)\s*(k|thousand|lakh|lac)?/g),
  ];
  if (!matches.length) return null;
  const match = matches.at(-1)!,
    base = Number(match[1].replaceAll(',', ''));
  const multiplier =
    match[2] === 'k' || match[2] === 'thousand'
      ? 1000
      : match[2] === 'lakh' || match[2] === 'lac'
        ? 100000
        : 1;
  const paise = Math.round(base * multiplier * 100);
  return Number.isSafeInteger(paise) && paise > 0 && paise <= 1_000_000_000 ? paise : null;
}

export function chatReply(data: Data, message: string, context: ChatContext = {}): ChatReply {
  const text = message.toLowerCase().trim(),
    amount = parseAmount(text),
    summary = calculate(data);
  const account = data.accounts.find((item) => item.id === context.accountId);
  const card = data.cards.find((item) => item.id === context.cardId);
  if (!text) return { answer: 'Please write your question or transaction.', details: [] };
  if (/(salary|salry|sallery).*(credit|aaya|aya|mila|receive)/.test(text)) {
    if (!amount)
      return {
        answer: 'Salary amount is missing. Example: “Today salary 55000 credited.”',
        details: [],
      };
    if (!account)
      return {
        answer: 'Select the account where salary arrived, then send the message again.',
        details: [],
      };
    return {
      answer: `${INR(amount)} salary can be recorded in ${account.name}.`,
      details: ['This will increase bank cash once and mark the salary as received.'],
      draft: {
        kind: 'income',
        amount,
        date: today(),
        source: 'Salary',
        recurring: true,
        status: 'RECEIVED',
        accountId: account.id,
        notes: 'Recorded from MoneyPath chat',
      },
      confirmation: `Record ${INR(amount)} salary in ${account.name}?`,
    };
  }
  if (
    /(friend|frnd|dost).*(udhar|borrow|loan|liya|lia)|(?:udhar|borrow).*(friend|frnd|dost)/.test(
      text,
    )
  ) {
    if (!amount) return { answer: 'Borrowed amount is missing.', details: [] };
    if (!account)
      return { answer: 'Select the account that received the borrowed money.', details: [] };
    return {
      answer: `${INR(amount)} interest-free personal borrowing will solve only that much of the cash gap. It remains a liability until repaid.`,
      details: [
        `Current recorded shortfall: ${INR(summary.safe.shortfall ?? 0)}.`,
        `After receipt, account cash rises by ${INR(amount)}, while private debt rises by the same amount.`,
      ],
      draft: {
        kind: 'personalTransfer',
        direction: 'PAYABLE',
        reference: 'Friend borrowing',
        accountId: account.id,
        amount,
        date: today(),
        dueDate: null,
        priority: 'NORMAL',
        notes: 'Interest-free borrowing recorded from MoneyPath chat',
      },
      confirmation: `Record ${INR(amount)} received from a friend as private debt in ${account.name}?`,
    };
  }
  if (
    /(credit card|card).*(cash|nikal|withdraw)|(?:cash|nikal|withdraw).*(credit card|card)/.test(
      text,
    )
  ) {
    if (!amount) return { answer: 'Cash-advance amount is missing.', details: [] };
    if (!card || !account)
      return { answer: 'Select both the credit card and destination bank account.', details: [] };
    return {
      answer: `I do not recommend a ${INR(amount)} card cash advance unless an unavoidable payment has no safer funding source.`,
      details: [
        `It creates ${INR(amount)} new card debt immediately.`,
        `Issuer fees and interest are not known; record them separately when charged.`,
        `Recorded safe-to-spend: ${summary.safe.available === null ? 'Information Required' : INR(summary.safe.available)}.`,
      ],
      draft: {
        kind: 'cashAdvance',
        cardId: card.id,
        accountId: account.id,
        amount,
        date: today(),
        notes: 'Cash advance recorded from MoneyPath chat; fees/interest must be added separately',
      },
      confirmation: `Despite the warning, record ${INR(amount)} cash advance from ${card.name} into ${account.name}?`,
    };
  }
  if (/(emergency|urgent|medical).*(expense|kharcha|pay|payment)/.test(text)) {
    if (!amount) return { answer: 'Emergency amount is missing.', details: [] };
    const plan = emergencyAdjustment(data, amount);
    return { answer: plan.title, details: plan.steps };
  }
  if (
    /(purchase|buy|kharid|kharcha|spend).*(karu|kare|possible|can|chahiye|chahta|price)/.test(
      text,
    ) ||
    /(karu|possible|can).*(purchase|buy|kharid|kharcha)/.test(text)
  ) {
    if (!amount)
      return {
        answer: 'Tell me the purchase price. Example: “Can I buy a phone for 25000?”',
        details: [],
      };
    if (summary.required.length)
      return {
        answer: 'I cannot safely answer yet.',
        details: [`Complete ${summary.required.join(', ')}.`],
      };
    const remaining = summary.safe.available! - amount,
      optional = /phone|mobile|shopping|want|optional/.test(text);
    if (amount > summary.safe.available!)
      return {
        answer: `No. Do not make this ${INR(amount)} purchase now.`,
        details: [
          `It exceeds safe-to-spend by ${INR(-remaining)}.`,
          `Cash ${INR(summary.cash)}; protected bills and reserves ${INR(summary.cash - summary.safe.raw!)}.`,
          `Review Payment priorities before arranging any new borrowing.`,
        ],
      };
    if (optional && summary.debt > 0)
      return {
        answer: `No for now. The amount fits cash, but this optional purchase should wait while ${INR(summary.debt)} card debt remains.`,
        details: [
          `If purchased, safe-to-spend would fall from ${INR(summary.safe.available!)} to ${INR(remaining)}.`,
        ],
      };
    return {
      answer: `Yes, this purchase fits the recorded plan.`,
      details: [
        `Safe-to-spend after purchase: ${INR(Math.max(0, remaining))}.`,
        `Recheck if any bill, balance or emergency entry changes.`,
      ],
    };
  }
  if (/(short|kam|arrange|manage).*(payment|paisa|money)|(?:payment).*(short|kam)/.test(text)) {
    const priorities = paymentPriority(data)
      .ranked.filter((item) => item.withinHorizon)
      .slice(0, 3);
    return {
      answer: summary.safe.shortfall
        ? `Balaram, this salary-cycle plan is short by ${INR(summary.safe.shortfall)}.`
        : 'No recorded salary-cycle shortfall is visible right now.',
      details: [
        ...priorities.map((item) => `${item.name}: ${INR(item.amount)} due ${item.date}.`),
        summary.safe.shortfall
          ? 'First stop optional spending and review optional contributions. Arrange only the remaining verified gap; do not assume a loan automatically.'
          : `Current safe-to-spend is ${summary.safe.available === null ? 'Information Required' : INR(summary.safe.available)}.`,
      ],
    };
  }
  if (/(aaj|today|abhi|now).*(kya|what).*(karu|do)|guide|plan bata/.test(text)) {
    const plan = financialActionPlan(data);
    return {
      answer: plan.headline,
      details: plan.actions.map((action) => `${action.level}: ${action.title} — ${action.detail}`),
    };
  }
  if (/(expense|kharcha|spent).*(hua|kiya|record|add)/.test(text)) {
    if (!amount) return { answer: 'Expense amount is missing.', details: [] };
    if (!account) return { answer: 'Select the account used for this expense.', details: [] };
    const category = /fuel|petrol|diesel/.test(text)
      ? 'Fuel'
      : /sabji|ration|grocery/.test(text)
        ? 'Groceries'
        : /recharge|mobile/.test(text)
          ? 'Mobile Recharge'
          : 'Other';
    return {
      answer: `I can record ${INR(amount)} under ${category}.`,
      details: [`It will reduce ${account.name} once and update this month's budget.`],
      draft: {
        kind: 'expense',
        amount,
        date: today(),
        category,
        method: 'Bank Transfer',
        essentiality: category === 'Other' ? 'IMPORTANT/FLEXIBLE' : 'MUST HAVE',
        accountId: account.id,
        description: message.slice(0, 100),
      },
      confirmation: `Record this ${INR(amount)} expense from ${account.name}?`,
    };
  }
  const plan = financialActionPlan(data);
  return {
    answer:
      'I understood this as a request for your current plan. For recording, include the amount and words such as salary credited, expense, borrowed from friend, or card cash advance.',
    details: plan.actions
      .slice(0, 3)
      .map((action) => `${action.level}: ${action.title} — ${action.detail}`),
  };
}
