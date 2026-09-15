import { calculate, INR, today, type Data } from './finance';
import { financialActionPlan, emergencyAdjustment } from './guidance';
import { paymentPriority, salaryAllocation, simulatePurchase } from './decision';
import { spendingReport } from './planning';
import { goalSummary } from './goals';
import type { Command } from './validation';

export type ChatMemory = {
  intent?: 'PURCHASE';
  item?: string;
  amount?: number;
  method?: 'CASH' | 'CARD';
};
export type ChatContext = { accountId?: string; cardId?: string; memory?: ChatMemory };
export type ChatReply = {
  answer: string;
  details: string[];
  draft?: Command;
  confirmation?: string;
  memory?: ChatMemory;
};

export function normalizeChatText(message: string) {
  return message
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\b(finaceial|finanical|finacial|fincial|finence|fainance)\b/g, 'financial')
    .replace(/\b(salry|sallery|selary|salery)\b/g, 'salary')
    .replace(/\b(crdit|credt|creadit)\s*(card)?\b/g, 'credit card')
    .replace(/\b(payemnt|paymant|pament|pyment)\b/g, 'payment')
    .replace(/\b(expance|expence|exepnse|kharacha|khracha)\b/g, 'expense')
    .replace(/\b(purches|parchase|puchase)\b/g, 'purchase')
    .replace(/\b(recive|recived|recieved)\b/g, 'receive')
    .replace(/\b(borow|borrowd)\b/g, 'borrowed')
    .replace(
      /(?:मेरी|मेरा)\s+(?:वर्तमान|अभी की)\s+(?:वित्तीय|आर्थिक)\s+स्थिति/g,
      'mera current financial status',
    )
    .replace(/(?:वित्तीय|आर्थिक)\s+स्थिति/g, 'financial status')
    .replace(/वेतन|तनख्वाह/g, 'salary')
    .replace(/क्रेडिट\s*कार्ड/g, 'credit card')
    .replace(/भुगतान/g, 'payment')
    .replace(/बाकी/g, 'baki')
    .replace(/खर्च|ख़र्च/g, 'expense')
    .replace(/खरीद(?:ना|ारी)?/g, 'purchase')
    .replace(/उधार/g, 'borrowed')
    .replace(/मिला|आया|प्राप्त हुआ/g, 'receive')
    .replace(/सही|ठीक/g, 'sahi')
    .replace(/कैस[ाी]/g, 'kaisa')
    .replace(/है/g, 'hai')
    .replace(/\s+/g, ' ')
    .trim();
}

function asksForCurrentStatus(text: string) {
  const financeWord = /financ(?:e|ial)|finanical|finaceial|fincial|money/;
  return (
    /(current status|mera status|my status|money status)/.test(text) ||
    (financeWord.test(text) && /(status|sahi|thik|theek|kaisa|haal|condition)/.test(text))
  );
}

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

function selectedAccount(data: Data, context: ChatContext, text: string) {
  const normalized = text.toLowerCase();
  return (
    data.accounts.find((item) => normalized.includes(item.name.toLowerCase())) ??
    data.accounts.find((item) =>
      item.name
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .some((token) => token.length >= 3 && normalized.includes(token)),
    ) ??
    data.accounts.find((item) => item.id === context.accountId) ??
    data.accounts.find((item) => item.spendable)
  );
}

function selectedCard(data: Data, context: ChatContext, text: string) {
  return (
    data.cards.find((item) =>
      [item.name, item.bank].some((name) => text.toLowerCase().includes(name.toLowerCase())),
    ) ?? data.cards.find((item) => item.id === context.cardId)
  );
}

function purchaseExplanation(data: Data, amount: number, context: ChatContext, text: string) {
  const account = selectedAccount(data, context, text);
  const card = selectedCard(data, context, text);
  const method: 'CASH' | 'CARD' = /card se|credit card/.test(text)
    ? 'CARD'
    : (context.memory?.method ?? 'CASH');
  const item = /mobile|phone/.test(text) ? 'Mobile' : (context.memory?.item ?? 'Purchase');
  if (method === 'CASH' && !account)
    return { answer: 'Cash purchase check ke liye spendable account select karein.', details: [] };
  if (method === 'CARD' && !card)
    return { answer: 'Card purchase check ke liye credit card select karein.', details: [] };
  const result = simulatePurchase(data, {
    item,
    price: amount,
    method,
    essentiality: /medical|school|essential|zaruri/.test(text) ? 'MUST HAVE' : 'WANT',
    accountId: account?.id,
    cardId: card?.id,
  });
  return {
    answer: `${result.level >= 3 ? 'No.' : result.level === 2 ? 'Caution.' : 'Yes.'} ${result.label}. ${amount > (result.before.safe.available ?? 0) ? 'Abhi recommended nahi hai.' : result.level >= 3 ? 'Abhi avoid karna better hai.' : 'Recorded plan me fit hota hai.'}`,
    details: [
      `Current cash: ${INR(result.before.cash)}.`,
      `Upcoming obligations and reserves: ${INR(result.before.cash - (result.before.safe.raw ?? 0))}.`,
      `Current safe-to-spend: ${result.before.safe.available === null ? 'Information Required' : INR(result.before.safe.available)}.`,
      ...(result.after
        ? [`Purchase ke baad safe-to-spend: ${INR(result.after.safe.available ?? 0)}.`]
        : []),
      ...result.reasons.slice(0, 4),
    ],
    memory: { intent: 'PURCHASE' as const, item, amount, method },
  };
}

export function chatReply(data: Data, message: string, context: ChatContext = {}): ChatReply {
  const text = normalizeChatText(message),
    amount = parseAmount(text),
    summary = calculate(data);
  const account = selectedAccount(data, context, text);
  const card = selectedCard(data, context, text);
  if (!text) return { answer: 'Please write your question or transaction.', details: [] };
  if (/(cancel|rehne do|mat save|nahi save)/.test(text))
    return {
      answer: 'Theek hai, proposed entry cancel kar di. Koi financial record change nahi hua.',
      details: [],
    };
  if (asksForCurrentStatus(text)) {
    const report = spendingReport(data, summary.asOf.slice(0, 7));
    const next = summary.obligations.find((item) => item.amount > 0);
    const incompleteCards = data.cards.filter((item) => item.detailsComplete === false).length;
    const status = summary.required.length
      ? 'Abhi final status fully verified nahi hai, aur recorded position ko attention chahiye.'
      : (summary.safe.shortfall ?? 0) > 0 || (summary.risk.score ?? 0) > 50
        ? 'Abhi financial status healthy nahi hai; spending aur payments ko carefully manage karna hoga.'
        : 'Recorded data ke hisab se current financial status manageable hai.';
    return {
      answer: `${data.settings.name || 'Balaram'}, ${status}`,
      details: [
        `Bank/cash: ${INR(summary.cash)}; safe-to-spend: ${summary.safe.available === null ? 'Information Required' : INR(summary.safe.available)}.`,
        `Credit-card debt: ${INR(summary.debt)}; other debt: ${INR(summary.privateDebt)}.`,
        `Next salary horizon: ${summary.horizon ?? 'Information Required'}${next ? `; next payment ${next.name} ${INR(next.amount)} due ${next.date}` : ''}.`,
        `This month spent: ${INR(report.total)} (essential ${INR(report.essential)}, flexible ${INR(report.flexible)}, wants ${INR(report.wants)}).`,
        `Risk: ${summary.risk.score === null ? 'Information Required' : `${summary.risk.score}/100 ${summary.risk.label}`}.`,
        ...(incompleteCards
          ? [
              `${incompleteCards} credit cards ki statement, due date, limit aur interest details Cards page par verify karein.`,
            ]
          : [financialActionPlan(data).actions[0]?.detail ?? 'Keep records current.']),
      ],
    };
  }
  if (
    /(credit card|card).*(kitna|how much|baki|baaki|left|due|outstanding|balance)|(?:kitna|how much|baki|baaki|left|due|outstanding).*(credit card|card)/.test(
      text,
    )
  ) {
    const incompleteCards = data.cards.filter((item) => item.detailsComplete === false).length;
    const balances = data.cards
      .map((item) => ({
        name: item.name,
        debt:
          item.outstanding + item.emis.reduce((total, emi) => total + emi.principalRemaining, 0),
        billed: Math.max(0, item.statementAmount - item.statementPaid),
      }))
      .filter((item) => item.debt > 0)
      .sort((a, b) => b.debt - a.debt);
    return {
      answer: `Total recorded credit-card debt ${INR(summary.debt)} hai. Isme currently recorded statement payment ${INR(summary.oldBill)} baki hai.`,
      details: [
        `Remaining ${INR(Math.max(0, summary.debt - summary.oldBill))} posted/unbilled debt aur recorded EMI principal hai.`,
        ...balances.map(
          (item) =>
            `${item.name}: total ${INR(item.debt)}${item.billed > 0 ? `; billed payment baki ${INR(item.billed)}` : ''}.`,
        ),
        ...(incompleteCards
          ? [
              `Confidence: provisional. ${incompleteCards} cards ki latest statement/due details verify hone ke baad exact payable amount update hoga.`,
            ]
          : ['Confidence: verified from the latest recorded card details.']),
      ],
    };
  }
  if (/(risk).*(kyu|why|explain)|(?:kyu|why).*(risk)/.test(text))
    return {
      answer:
        summary.risk.score === null
          ? 'Risk explain karne ke liye required financial setup complete nahi hai.'
          : `Recorded risk ${summary.risk.score}/100 (${summary.risk.label}) hai.`,
      details:
        summary.risk.score === null
          ? summary.required.map((item) => `Complete: ${item}`)
          : summary.risk.rules.map(
              (rule) => `${rule.points >= 0 ? '+' : ''}${rule.points}: ${rule.reason}`,
            ),
    };
  if (/(kis|kaun).*(card|payment).*(pehle|first)|abhi kis kis ko payment/.test(text)) {
    const rows = paymentPriority(data).ranked.slice(0, 5);
    return {
      answer: rows.length
        ? 'Actual due dates, risk aur protected cash ke hisab se priority:'
        : 'Koi recorded payment priority nahi mili.',
      details: rows.map(
        (item, index) =>
          `${index + 1}. ${item.action}: ${item.name} ${INR(item.amount)}, due ${item.date}. ${item.reasons.slice(0, 2).join('; ')}.`,
      ),
    };
  }
  if (/(maximum|max|kitne ka).*(mobile|phone|purchase|le sakta)/.test(text)) {
    if (summary.safe.available === null)
      return {
        answer: 'Safe purchase ceiling calculate nahi ho sakti.',
        details: summary.required,
      };
    const ceiling = Math.max(0, Math.floor(summary.safe.available / 10000) * 10000);
    return {
      answer: `Current safe cash purchase ceiling ${INR(ceiling)} hai.`,
      details: [
        `Yeh available card limit par based nahi hai. Current safe-to-spend ${INR(summary.safe.available)} hai.`,
        'Thoda buffer rakhne ke liye exact ceiling se kam spend karna safer hai.',
      ],
    };
  }
  if (/(sip|gold saving|investment).*(continue|pause|start|karu)/.test(text)) {
    const optional = (data.investments ?? []).reduce(
      (sum, item) => sum + item.monthlyContribution,
      0,
    );
    const stressed = !!summary.safe.shortfall || summary.debt > 0;
    return {
      answer: stressed
        ? 'Optional investment contribution ko abhi review/pause karna reasonable hai; insurance ko is answer me stop nahi maana gaya.'
        : 'Recorded cash flow me contribution continue karne ki capacity dikh rahi hai.',
      details: [
        `Optional monthly investment contributions: ${INR(optional)}.`,
        `Safe-to-spend: ${summary.safe.available === null ? 'Information Required' : INR(summary.safe.available)}; card debt: ${INR(summary.debt)}.`,
        'Product exit charge, lock-in aur tax conditions MoneyPath me recorded nahi hain; change se pehle verify karein.',
      ],
    };
  }
  if (/(salary).*(plan|kya karu|allocate)/.test(text)) {
    const plan = salaryAllocation(data);
    return {
      answer: 'Aapka salary plan recorded obligations aur reserves se calculate hua hai.',
      details: [
        ...plan.groups.map((group) => `${group.category}: ${INR(group.amount)}`),
        `Mandatory total: ${INR(plan.mandatory)}; essential reserve: ${INR(data.settings.essentialReserve ?? 0)}; emergency reserve: ${INR(data.settings.emergencyReserve ?? 0)}.`,
        `Safe-to-spend until next salary: ${plan.safe.available === null ? 'Information Required' : INR(plan.safe.available)}.`,
      ],
    };
  }
  if (/(marriage|shaadi).*(plan|status|save|kitna)/.test(text)) {
    const goal = (data.goals ?? []).find((item) => item.kind === 'MARRIAGE');
    if (!goal)
      return {
        answer:
          'Marriage goal abhi recorded nahi hai. Goals page par target date aur amounts add karein.',
        details: [],
      };
    const result = goalSummary(goal, summary.asOf);
    return {
      answer: `${goal.name} ke liye confirmed shortfall ${INR(result.shortfall)} hai.`,
      details: [
        `Target ${INR(result.total)} by ${goal.targetDate}; confirmed ${INR(result.confirmed)}.`,
        `Required monthly amount approximately ${INR(result.requiredMonthly)} for ${result.monthsRemaining} month(s).`,
        `Expected money ${INR(result.expected)} separately shown hai; receive hone tak cash/safe-to-spend me count nahi hai.`,
      ],
    };
  }
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
    amount &&
    account &&
    /(add|deposit|jama|credit|saving|save)/.test(text) &&
    !/(expense|payment|card|borrow|udhar|salary|transfer)/.test(text)
  ) {
    return {
      answer: `${INR(amount)} ${account.name} me add karne ka request samjha hai. Source mention nahi hai, isliye ise Other Income ke roop me confirmation ke liye prepare kiya hai.`,
      details: [
        `Confirm karne par ${account.name} balance ${INR(amount)} increase hoga.`,
        'Agar yeh aapke dusre account ya cash se transfer hai, Cancel karein aur source likhein; transfer ko income count karna galat hoga.',
      ],
      draft: {
        kind: 'income',
        amount,
        date: today(),
        source: 'Other Income',
        recurring: false,
        status: 'RECEIVED',
        accountId: account.id,
        notes: 'Unclassified deposit recorded from MoneyPath chat',
      },
      confirmation: `Add ${INR(amount)} to ${account.name} as Other Income?`,
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
  if (
    /(card).*(payment|pay|jama).*(kiya|hua|kar diya)|(?:payment).*(card).*(kiya|hua)/.test(text)
  ) {
    if (!amount) return { answer: 'Card payment amount missing hai.', details: [] };
    if (!card || !account)
      return {
        answer: 'Payment record karne ke liye bank account aur credit card select karein.',
        details: [],
      };
    const statementRemaining = Math.max(0, card.statementAmount - card.statementPaid);
    if (statementRemaining > 0 && amount > statementRemaining)
      return {
        answer: 'Is payment ko statement aur unbilled portions me split karke confirm karna hoga.',
        details: [
          `Remaining statement ${INR(statementRemaining)} hai. Pehle itna statement payment record karein; remaining ${INR(amount - statementRemaining)} ko separate unbilled payment ke roop me record karein.`,
          'Is split ke bina MoneyPath silently allocation assume nahi karega.',
        ],
      };
    return {
      answer: `${INR(amount)} ${card.name} payment ${account.name} se prepare kiya hai.`,
      details: [
        `Bank cash ${INR(amount)} reduce hoga aur card liability ${INR(amount)} reduce hogi.`,
        'Yeh expense nahi hai, isliye spending double count nahi hogi.',
      ],
      draft: {
        kind: 'payment',
        accountId: account.id,
        cardId: card.id,
        amount,
        date: today(),
        type: statementRemaining > 0 ? 'STATEMENT' : 'UNBILLED',
        notes: 'Recorded from MoneyPath Finance Assistant',
      },
      confirmation: `Pay ${INR(amount)} to ${card.name} from ${account.name}?`,
    };
  }
  if (
    /(card se|credit card se).*(purchase|kharid|kharcha|grocery|petrol)|(?:purchase|kharid|grocery).*(card se|credit card)/.test(
      text,
    )
  ) {
    if (!amount) return { answer: 'Card purchase amount missing hai.', details: [] };
    if (!card)
      return { answer: 'Purchase record karne ke liye credit card select karein.', details: [] };
    const category = /fuel|petrol|diesel/.test(text)
      ? 'Fuel'
      : /sabji|ration|grocery/.test(text)
        ? 'Groceries'
        : /recharge|mobile/.test(text)
          ? 'Mobile Recharge'
          : 'Other';
    const simulation = simulatePurchase(data, {
      item: category,
      price: amount,
      method: 'CARD',
      essentiality: category === 'Other' ? 'WANT' : 'MUST HAVE',
      cardId: card.id,
    });
    return {
      answer: `${INR(amount)} ${category} purchase on ${card.name} prepare kiya hai.`,
      details: [
        'Bank balance abhi reduce nahi hoga; expense aur card liability dono update honge.',
        `Simulation: ${simulation.label}.`,
        ...simulation.reasons.slice(0, 2),
      ],
      draft: {
        kind: 'expense',
        amount,
        date: today(),
        category,
        method: 'Credit Card',
        essentiality: category === 'Other' ? 'WANT' : 'MUST HAVE',
        cardId: card.id,
        description: message.slice(0, 100),
      },
      confirmation: `Record ${INR(amount)} ${category} expense on ${card.name}?`,
    };
  }
  if (/(emergency|urgent|medical).*(expense|kharcha|pay|payment)/.test(text)) {
    if (!amount) return { answer: 'Emergency amount is missing.', details: [] };
    const plan = emergencyAdjustment(data, amount);
    if (!account)
      return {
        answer: `${plan.title}. Expense record karne ke liye account select karein.`,
        details: plan.steps,
      };
    return {
      answer: plan.title,
      details: [
        `Safe-to-spend before expense: ${summary.safe.available === null ? 'Information Required' : INR(summary.safe.available)}.`,
        ...plan.steps,
      ],
      draft: {
        kind: 'expense',
        amount,
        date: today(),
        category: 'Medical',
        method: 'UPI',
        essentiality: 'MUST HAVE',
        accountId: account.id,
        description: message.slice(0, 100),
      },
      confirmation: `Record ${INR(amount)} emergency expense from ${account.name}?`,
    };
  }
  if (
    /(purchase|buy|kharid|kharcha|spend).*(karu|kare|possible|can|chahiye|chahta|price)/.test(
      text,
    ) ||
    /(karu|possible|can).*(purchase|buy|kharid|kharcha)/.test(text) ||
    /(mobile|phone).*(le sakta|buy|purchase|kharid)/.test(text) ||
    (context.memory?.intent === 'PURCHASE' && (!!amount || /card se|cash se/.test(text)))
  ) {
    const purchaseAmount = amount ?? context.memory?.amount;
    if (!purchaseAmount)
      return {
        answer: 'Tell me the purchase price. Example: “Can I buy a phone for 25000?”',
        details: [],
      };
    if (summary.required.length)
      return {
        answer: 'I cannot safely answer yet.',
        details: [`Complete ${summary.required.join(', ')}.`],
      };
    return purchaseExplanation(data, purchaseAmount, context, text);
  }
  if (/(kitna).*(kharch|spend).*(sakta|available)|safe.to.spend/.test(text))
    return {
      answer:
        summary.safe.available === null
          ? 'Safe-to-spend calculate karne ke liye information incomplete hai.'
          : `Balaram, abhi ${INR(summary.safe.available)} safely spendable hai.`,
      details:
        summary.safe.available === null
          ? summary.required
          : [
              `Account cash ${INR(summary.cash)} me se ${INR(summary.mandatory)} upcoming payments ke liye reserved hai.`,
              `Essential, emergency, goal aur debt reserves bhi calculation me protected hain.`,
            ],
    };
  if (/(paisa kaha|where).*(jyada|most)|overspend|over budget/.test(text)) {
    const report = spendingReport(data, summary.asOf.slice(0, 7));
    const rows = report.rows.filter((row) => row.actual > 0).slice(0, 5);
    return {
      answer: rows.length
        ? 'Is month recorded spending ka breakdown:'
        : 'Is month koi recorded expense nahi hai.',
      details: rows.map(
        (row) =>
          `${row.category}: ${INR(row.actual)}${row.budget === null ? ' (budget not set)' : ` of ${INR(row.budget)} budget${row.variance?.overBudget ? `; ${INR(row.actual - row.budget)} over` : ''}`}`,
      ),
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
  if (amount && account)
    return {
      answer: `${INR(amount)} aur ${account.name} samajh aaya, lekin paisa account me aa raha hai ya account se ja raha hai yeh clear nahi hai.`,
      details: [
        'Natural language me source/action add karein, jaise “salary aayi”, “cash deposit”, “SBI se transfer”, ya “expense hua”.',
        'MoneyPath direction guess karke balance ya income ko galat nahi karega.',
      ],
    };
  return {
    answer: 'Main is message ka exact financial action confidently identify nahi kar paya.',
    details: [
      'Natural language me amount, account/card aur paisa aaya ya gaya likhein; MoneyPath relevant record ya answer prepare karega.',
    ],
  };
}
