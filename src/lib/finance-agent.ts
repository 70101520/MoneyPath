import { calculate, INR, type Data } from './finance';
import { simulatePurchase, paymentPriority } from './decision';
import { spendingReport } from './planning';
import { goalSummary } from './goals';
import { parseAmount, type ChatContext, type ChatReply } from './chat';
import type { AiRuntime } from './ai-settings';

type Query =
  | 'conversation'
  | 'snapshot'
  | 'savings'
  | 'available_cash'
  | 'cash_outflow'
  | 'cards'
  | 'priorities'
  | 'spending'
  | 'goals';
type Mutation =
  | 'none'
  | 'income'
  | 'expense'
  | 'friend_borrowing'
  | 'card_payment'
  | 'cash_advance'
  | 'account_deposit'
  | 'card_balance_update';
type Plan = {
  queries: Query[];
  primaryQuery: Query;
  mutation: Mutation;
  accountQuery: string;
  cardQuery: string;
  needsClarification: string;
};
type CalculationRequest = {
  label: string;
  operation: 'sum' | 'subtract' | 'minimum' | 'maximum';
  operands: string[];
};

const plannerSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'queries',
    'primaryQuery',
    'mutation',
    'accountQuery',
    'cardQuery',
    'needsClarification',
  ],
  properties: {
    queries: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['conversation', 'snapshot', 'savings', 'available_cash', 'cash_outflow', 'cards', 'priorities', 'spending', 'goals'],
      },
    },
    primaryQuery: {
      type: 'string',
      enum: ['conversation', 'snapshot', 'savings', 'available_cash', 'cash_outflow', 'cards', 'priorities', 'spending', 'goals'],
    },
    mutation: {
      type: 'string',
      enum: [
        'none',
        'income',
        'expense',
        'friend_borrowing',
        'card_payment',
        'cash_advance',
        'account_deposit',
        'card_balance_update',
      ],
    },
    accountQuery: { type: 'string', maxLength: 80 },
    cardQuery: { type: 'string', maxLength: 80 },
    needsClarification: { type: 'string', maxLength: 160 },
  },
} as const;
const agentSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'queries',
    'primaryQuery',
    'mutation',
    'accountQuery',
    'cardQuery',
    'needsClarification',
    'answer',
    'details',
    'calculations',
  ],
  properties: {
    ...plannerSchema.properties,
    answer: { type: 'string', maxLength: 700 },
    details: {
      type: 'array',
      items: { type: 'string', maxLength: 220 },
      maxItems: 3,
    },
    calculations: {
      type: 'array',
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'operation', 'operands'],
        properties: {
          label: { type: 'string', maxLength: 100 },
          operation: { type: 'string', enum: ['sum', 'subtract', 'minimum', 'maximum'] },
          operands: { type: 'array', minItems: 1, maxItems: 20, items: { type: 'string', maxLength: 40 } },
        },
      },
    },
  },
} as const;

async function structuredResponse(
  name: string,
  schema: object,
  instructions: string,
  input: string,
  runtime?: AiRuntime,
) {
  const configuredProvider = (process.env.AI_PROVIDER ?? 'ollama').toUpperCase();
  const selected = runtime ?? (configuredProvider === 'OPENAI'
    ? {
        provider: 'OPENAI',
        baseUrl: 'https://api.openai.com/v1',
        model: process.env.OPENAI_MODEL ?? 'gpt-5.5',
        apiKey: process.env.OPENAI_API_KEY,
      }
    : configuredProvider === 'GPT_OSS' || configuredProvider === 'GPT-OSS'
      ? {
          provider: 'GPT_OSS',
          baseUrl: process.env.GPT_OSS_BASE_URL ?? 'http://gpt-oss:8000/v1',
          model: process.env.GPT_OSS_MODEL ?? 'openai/gpt-oss-20b',
        }
      : {
          provider: 'OLLAMA',
          baseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
          model: process.env.OLLAMA_MODEL ?? 'qwen3.5:4b-q4_K_M',
        }) as AiRuntime;
  if (selected.provider === 'OLLAMA') {
    const baseUrl = selected.baseUrl.replace(/\/$/, '');
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(`${baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(120000),
          body: JSON.stringify({
            model: selected.model,
            stream: false,
            format: schema,
            think: false,
            options: { temperature: 0, num_ctx: 4096, num_predict: 320 },
            messages: [
              { role: 'system', content: instructions },
              {
                role: 'user',
                content: `${input}\n\nReturn only JSON matching this schema:\n${JSON.stringify(schema)}`,
              },
            ],
          }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error ?? 'Local AI provider request failed');
        const output = body?.message?.content;
        if (!output) throw new Error('Local AI provider returned no structured answer');
        return JSON.parse(output);
      } catch (error) {
        lastError = error;
        if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    throw lastError;
  }
  if (selected.provider === 'GPT_OSS') {
    const response = await fetch(`${selected.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(300000),
      body: JSON.stringify({
        model: selected.model,
        temperature: 0,
        stream: false,
        messages: [
          { role: 'system', content: instructions },
          { role: 'user', content: input },
        ],
        response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } },
      }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body?.error?.message ?? 'GPT-OSS provider request failed');
    const output = body?.choices?.[0]?.message?.content;
    if (!output) throw new Error('GPT-OSS provider returned no structured answer');
    return JSON.parse(output);
  }
  const key = selected.apiKey;
  if (!key) throw new Error('OpenAI API key is not configured');
  const response = await fetch(`${selected.baseUrl.replace(/\/$/, '')}/responses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      model: selected.model,
      store: false,
      reasoning: { effort: 'medium' },
      text: { verbosity: 'low', format: { type: 'json_schema', name, strict: true, schema } },
      instructions,
      input,
      max_output_tokens: 1200,
    }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.message ?? 'AI provider request failed');
  const output =
    body.output_text ??
    body.output
      ?.flatMap((item: any) => item.content ?? [])
      .find((item: any) => item.type === 'output_text')?.text;
  if (!output) throw new Error('AI provider returned no structured answer');
  return JSON.parse(output);
}

function findNamed<T extends { id: string; name: string }>(
  rows: T[],
  query: string,
  selected?: string,
) {
  const words = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3);
  const named = rows.find((row) => words.some((word) => row.name.toLowerCase().includes(word)));
  if (named) return named;
  return selected ? rows.find((row) => row.id === selected) : undefined;
}

function findUniquelyNamed<T extends { id: string; name: string }>(rows: T[], query: string) {
  const words = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3);
  const matches = rows.filter((row) =>
    words.some((word) => row.name.toLowerCase().includes(word)),
  );
  return matches.length === 1 ? matches[0] : undefined;
}

export function extractedAmount(message: string) {
  const match = message
    .toLowerCase()
    .match(/([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(k|thousand|lakh|lac)?/);
  if (!match) return parseAmount(message);
  const base = Number(match[1].replaceAll(',', ''));
  const multiplier =
    match[2] === 'k' || match[2] === 'thousand'
      ? 1000
      : match[2] === 'lakh' || match[2] === 'lac'
        ? 100000
        : 1;
  const paise = Math.round(base * multiplier * 100);
  return Number.isSafeInteger(paise) && paise > 0 && paise <= 1_000_000_000 ? paise : null;
}

function deterministicFacts(
  data: Data,
  queries: Query[],
  amount: number | null,
  context: ChatContext,
) {
  const summary = calculate(data),
    totalAccountBalances = data.accounts.reduce((sum, account) => sum + account.balance, 0),
    investmentValue = (data.investments ?? []).reduce(
      (sum, investment) => sum + investment.currentValue,
      0,
    ),
    facts: Record<string, unknown> = {
      asOf: summary.asOf,
      requestedAmount: amount === null ? null : INR(amount),
      snapshot: {
        cash: INR(summary.cash),
        safeToSpend: summary.safe.available === null ? null : INR(summary.safe.available),
        shortfall: summary.safe.shortfall === null ? null : INR(summary.safe.shortfall),
        nextSalary: summary.horizon,
        cardDebt: INR(summary.debt),
        privateDebt: INR(summary.privateDebt),
        mandatoryBeforeSalary: INR(summary.mandatory),
        risk:
          summary.risk.score === null ? null : `${summary.risk.score}/100 ${summary.risk.label}`,
        incompleteDataCount: summary.required.length,
      },
      savings: {
        accountColumns: ['name', 'kind', 'balance', 'spendable'],
        accounts: data.accounts.map((account) => [
          account.name,
          account.kind,
          INR(account.balance),
          account.spendable,
        ]),
        totalBankAndCash: INR(totalAccountBalances),
        investmentCurrentValue: INR(investmentValue),
        totalRecordedAccountsAndInvestments: INR(totalAccountBalances + investmentValue),
        safeToSpendAfterReservations:
          summary.safe.available === null ? null : INR(summary.safe.available),
      },
    };
  if (queries.includes('cash_outflow') && amount) {
    const account =
      data.accounts.find((row) => row.id === context.accountId) ??
      data.accounts.find((row) => row.spendable);
    if (account) {
      const result = simulatePurchase(data, {
        item: 'Possible cash outflow',
        price: amount,
        method: 'CASH',
        essentiality: 'WANT',
        accountId: account.id,
      });
      facts.cashOutflow = {
        amount: INR(amount),
        decision: result.label,
        level: result.level,
        beforeSafe:
          result.before.safe.available === null ? null : INR(result.before.safe.available),
        afterSafe:
          result.after?.safe.available === null || result.after?.safe.available === undefined
            ? null
            : INR(result.after.safe.available),
        reasons: result.reasons,
      };
    }
  }
  if (queries.includes('cards'))
    facts.cards = {
      columns: ['name', 'totalDebt', 'billedDue', 'dueDate', 'verified'],
      rows: data.cards.map((card) => [
        card.name,
        INR(card.outstanding + card.emis.reduce((sum, emi) => sum + emi.principalRemaining, 0)),
        INR(Math.max(0, card.statementAmount - card.statementPaid)),
        card.dueDate,
        card.detailsComplete !== false,
      ]),
    };
  if (queries.includes('cards')) {
    const billed = data.cards.reduce(
      (sum, card) => sum + Math.max(0, card.statementAmount - card.statementPaid),
      0,
    );
    const largestCard = data.cards
      .map((card) => ({
        name: card.name,
        totalDebt:
          card.outstanding + card.emis.reduce((sum, emi) => sum + emi.principalRemaining, 0),
      }))
      .sort((a, b) => b.totalDebt - a.totalDebt)[0];
    facts.cardTotals = {
      totalDebt: INR(summary.debt),
      billedDue: INR(billed),
      unbilledAndRemainingEmi: INR(Math.max(0, summary.debt - billed)),
      largestCard: largestCard
        ? { name: largestCard.name, totalDebt: INR(largestCard.totalDebt) }
        : null,
    };
  }
  if (queries.includes('priorities'))
    facts.priorities = {
      columns: ['name', 'amount', 'dueDate', 'action'],
      rows: paymentPriority(data)
        .ranked.slice(0, 5)
        .map((row) => [row.name, INR(row.amount), row.date, row.action]),
    };
  if (queries.includes('spending')) {
    const report = spendingReport(data, summary.asOf.slice(0, 7));
    facts.spending = {
      total: INR(report.total),
      essential: INR(report.essential),
      flexible: INR(report.flexible),
      wants: INR(report.wants),
      categoryColumns: ['category', 'actual', 'budget'],
      categories: report.rows
        .filter((row) => row.actual > 0 || (row.budget ?? 0) > 0)
        .slice(0, 10)
        .map((row) => [
          row.category,
          INR(row.actual),
          row.budget === null ? null : INR(row.budget),
        ]),
    };
  }
  if (queries.includes('goals'))
    facts.goals = (data.goals ?? []).map((goal) => {
      const value = goalSummary(goal, summary.asOf);
      return {
        name: goal.name,
        targetDate: goal.targetDate,
        target: INR(value.total),
        confirmed: INR(value.confirmed),
        expected: INR(value.expected),
        shortfall: INR(value.shortfall),
        monthlyRequired: INR(value.requiredMonthly),
      };
    });
  return facts;
}

function currencyValues(value: unknown) {
  return [...JSON.stringify(value).matchAll(/₹\s*([0-9][0-9,]*(?:\.[0-9]+)?)/g)].map(
    (match) => match[1].replaceAll(',', ''),
  );
}

function hasUngroundedCurrency(result: { answer: string; details: string[] }, facts: unknown) {
  const allowed = new Set(currencyValues(facts));
  return currencyValues(result).some((value) => !allowed.has(value));
}

function distinctDetails(answer: string, details: string[]) {
  const normalize = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}₹]+/gu, ' ').trim();
  const answerText = normalize(answer);
  const seen = new Set<string>();
  return details.filter((detail) => {
    const value = normalize(detail);
    if (!value || seen.has(value) || answerText.includes(value)) return false;
    seen.add(value);
    return true;
  });
}

function verifiedCalculations(requests: CalculationRequest[], facts: unknown) {
  const allowed = new Set(currencyValues(facts));
  return requests.flatMap((request) => {
    const values = request.operands.map((operand) => {
      const match = operand.match(/₹\s*([0-9][0-9,]*(?:\.[0-9]+)?)/);
      if (!match) return null;
      const normalized = match[1].replaceAll(',', '');
      if (!allowed.has(normalized)) return null;
      return Math.round(Number(normalized) * 100);
    });
    if (values.some((value) => value === null)) return [];
    const numbers = values as number[];
    if (!numbers.length || (request.operation === 'subtract' && numbers.length < 2)) return [];
    const result =
      request.operation === 'sum'
        ? numbers.reduce((sum, value) => sum + value, 0)
        : request.operation === 'subtract'
          ? numbers.slice(1).reduce((value, item) => value - item, numbers[0])
          : request.operation === 'minimum'
            ? Math.min(...numbers)
            : Math.max(...numbers);
    return [{ label: request.label, operation: request.operation, operands: request.operands, result: INR(result) }];
  });
}

function isGreetingOnly(message: string) {
  const words = message
    .toLocaleLowerCase('en-IN')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length || words.length > 8) return false;
  const greetingWords = new Set([
    'hi', 'hii', 'hiii', 'hai', 'hey', 'hello', 'helo', 'namaste', 'namaskar',
    'dost', 'yaar', 'bhai', 'money', 'path', 'moneypath', 'kaise', 'kaisa', 'ho',
    'good', 'morning', 'afternoon', 'evening', 'thanks', 'thank', 'you', 'shukriya',
  ]);
  return words.every((word) => greetingWords.has(word));
}

function prepareDraft(
  data: Data,
  plan: Plan,
  message: string,
  context: ChatContext,
): Pick<ChatReply, 'draft' | 'confirmation'> {
  const amount = extractedAmount(message);
  if (plan.mutation === 'none' || !amount || plan.needsClarification) return {};
  const explicitlyNamedAccount = findUniquelyNamed(data.accounts, message);
  const account =
    explicitlyNamedAccount ?? findNamed(data.accounts, plan.accountQuery || message, context.accountId);
  const explicitlyNamedCard = findUniquelyNamed(data.cards, message);
  const card =
    explicitlyNamedCard ?? findNamed(data.cards, plan.cardQuery || message, context.cardId);
  const base = { amount, date: new Date().toISOString().slice(0, 10) };
  if ((plan.mutation === 'income' || plan.mutation === 'account_deposit') && account)
    return {
      draft: {
        kind: 'income',
        ...base,
        source: plan.mutation === 'income' ? 'Other Income' : 'Other Income',
        recurring: false,
        status: 'RECEIVED',
        accountId: account.id,
        notes: 'Prepared by AI Finance Assistant',
      },
      confirmation: `Add ${INR(amount)} to ${account.name} as Other Income? Confirm only if this is not a transfer.`,
    };
  if (plan.mutation === 'expense' && account)
    return {
      draft: {
        kind: 'expense',
        ...base,
        category: 'Other',
        method: 'Bank Transfer',
        essentiality: 'IMPORTANT/FLEXIBLE',
        accountId: account.id,
        description: message.slice(0, 100),
      },
      confirmation: `Record ${INR(amount)} expense from ${account.name}?`,
    };
  if (plan.mutation === 'friend_borrowing' && account)
    return {
      draft: {
        kind: 'personalTransfer',
        direction: 'PAYABLE',
        reference: 'Friend borrowing',
        accountId: account.id,
        ...base,
        dueDate: null,
        priority: 'NORMAL',
        notes: 'Prepared by AI Finance Assistant',
      },
      confirmation: `Record ${INR(amount)} received as private debt in ${account.name}?`,
    };
  if (plan.mutation === 'card_payment' && account && card)
    return {
      draft: {
        kind: 'payment',
        accountId: account.id,
        cardId: card.id,
        ...base,
        type: card.statementAmount > card.statementPaid ? 'STATEMENT' : 'UNBILLED',
        notes: 'Prepared by AI Finance Assistant',
      },
      confirmation: `Record ${INR(amount)} payment to ${card.name} from ${account.name}?`,
    };
  if (plan.mutation === 'cash_advance' && account && card)
    return {
      draft: {
        kind: 'cashAdvance',
        accountId: account.id,
        cardId: card.id,
        ...base,
        notes: 'Prepared by AI Finance Assistant; fees must be recorded separately',
      },
      confirmation: `Record ${INR(amount)} cash advance from ${card.name} into ${account.name}?`,
    };
  if (plan.mutation === 'card_balance_update' && card)
    return {
      draft: {
        kind: 'updateCard',
        id: card.id,
        bank: card.bank,
        name: card.name,
        ...(card.lastFour ? { lastFour: card.lastFour } : {}),
        creditLimit: card.creditLimit,
        availableLimit: card.availableLimit,
        outstanding: amount,
        statementAmount: amount,
        statementPaid: 0,
        statementDate: card.statementDate,
        dueDate: card.dueDate,
        minimumDue: Math.min(card.minimumDue, amount),
        interestBps: card.interestBps,
        status: card.status as 'ACTIVE' | 'FROZEN' | 'CLOSED',
        detailsComplete: card.detailsComplete,
        notes: card.notes ?? undefined,
      },
      confirmation: `Update ${card.name} current due and outstanding to ${INR(amount)}?`,
    };
  return {};
}

export async function financeAgentReply(
  data: Data,
  message: string,
  context: ChatContext = {},
  history: string[] = [],
  runtime?: AiRuntime,
): Promise<ChatReply> {
  if (isGreetingOnly(message))
    return {
      answer: 'Haan dost, main yahin hoon. Batao, aaj kis cheez mein help chahiye?',
      details: [],
    };
  const entityCatalog = {
    accounts: data.accounts.map((row) => row.name),
    cards: data.cards.map((row) => row.name),
    goals: (data.goals ?? []).map((row) => row.name),
  };
  const amount = extractedAmount(message);
  const facts = deterministicFacts(
    data,
    ['snapshot', 'savings', 'available_cash', 'cash_outflow', 'cards', 'priorities', 'spending', 'goals'],
    amount,
    context,
  );
  const answerInstructions =
    'Use primaryQuery conversation for greetings, casual talk, thanks, introductions, or messages with no financial request. Respond warmly without forcing a financial status or quoting money. ' +
    'You are Balaram’s warm, direct personal finance head and semantic transaction planner. Understand unrestricted Hindi, English, Hinglish and typos. Always answer in natural Hinglish written with Latin/Roman letters unless the current user message explicitly asks for English or Devanagari Hindi. Never copy the writing style of older assistant messages over this response-language rule. Set primaryQuery to the single topic the user is actually asking about; queries may include supporting topics. Answer using only deterministicFacts. Copy monetary values exactly. Never invent or mentally calculate a monetary value. When arithmetic is needed, add a calculation request using exact ₹ operands copied from deterministicFacts; the backend will return verifiedCalculations for the final answer. If verifiedCalculations are present, use their exact results and return calculations as an empty array. Use primaryQuery savings only for questions about saved money, savings balance, bachat, bank savings or total saved assets. Use primaryQuery available_cash when asking how much money is free, available or safe to spend. Giving, lending, purchases and possible spending use primaryQuery cash_outflow. Goal targets, goal gaps and required monthly saving use primaryQuery goals. An imperative command to add/deposit/record an amount in a named bank or savings account is account_deposit, not a savings question. For savings questions, distinguish each account balance, totalBankAndCash, investmentCurrentValue, combined recorded value, and safe-to-spend; never label a total as one account balance. Choose mutation none for questions, advice, future possibilities and hypotheticals, including asking whether to take a loan. Choose friend_borrowing only when money was received/borrowed and should be recorded. Choose card_balance_update when the user commands updating a named card current due, outstanding or balance; put that card in cardQuery. Other completed/record commands map to income, account_deposit, expense, card_payment or cash_advance. A proposed mutation is only a draft requiring Confirm; never claim it was saved. Give a clear yes/no/caution when asked. When safe-to-spend is zero or a shortfall exists, recommend pausing optional investments and do not recommend new loans unless necessary to prevent a more serious immediate default; explain the reason. Answer the exact question first and use the relevant provided facts. Ask clarification only when required transaction data is absent. Keep answer concise and details distinct, non-repeating, at most 3. Do not mention implementation.';
  const answerInput = {
    recentConversation: history.slice(-8),
    entityCatalog,
    userMessage: message,
    responseStyle: 'Natural Hinglish in Latin/Roman letters. Use another script only when explicitly requested in the current message.',
    deterministicFacts: facts,
  };
  let result = (await structuredResponse(
    'finance_decision',
    agentSchema,
    answerInstructions,
    JSON.stringify(answerInput),
    runtime,
  )) as Plan & { answer: string; details: string[]; calculations: CalculationRequest[] };
  const calculations = verifiedCalculations(result.calculations ?? [], facts);
  const finalAnswerInput = calculations.length
    ? { ...answerInput, verifiedCalculations: calculations }
    : answerInput;
  if (calculations.length) {
    result = (await structuredResponse(
      'finance_decision_with_calculations',
      agentSchema,
      answerInstructions,
      JSON.stringify(finalAnswerInput),
      runtime,
    )) as Plan & { answer: string; details: string[]; calculations: CalculationRequest[] };
  }
  if (hasUngroundedCurrency(result, finalAnswerInput))
    result = (await structuredResponse(
      'finance_decision_grounded_retry',
      agentSchema,
      `${answerInstructions} Your previous response used a monetary value absent from the fact packet. Rewrite it using only exact ₹ values already present in deterministicFacts.`,
      JSON.stringify(finalAnswerInput),
      runtime,
    )) as Plan & { answer: string; details: string[]; calculations: CalculationRequest[] };
  const plan: Plan = result;
  const draft = prepareDraft(data, plan, message, context);
  const falselyClaimsDraft =
    !draft.draft && /\b(draft|confirm(?:ation)?)\b/i.test(result.answer);
  const answer = draft.confirmation
    ? `Draft prepared — ${draft.confirmation}`
    : plan.mutation !== 'none'
      ? plan.needsClarification ||
        'I could not prepare this transaction. Please specify valid source and destination accounts.'
      : falselyClaimsDraft
        ? `No transaction was prepared or saved. ${result.details[0] ?? ''}`.trim()
        : result.answer;
  const details = (plan.primaryQuery === 'conversation' ? [] : distinctDetails(answer, result.details)).filter(
    (detail) =>
      !draft.draft ||
      !/\b(recorded|saved|paid|completed|add(?:ed)?\s+ho|update(?:d)?\s+ho|ho gaya)\b/i.test(
        detail,
      ),
  );
  return {
    answer,
    details,
    ...draft,
  };
}

export function aiFinanceConfigured(runtime?: AiRuntime) {
  if (runtime) return runtime.provider !== 'OPENAI' || Boolean(runtime.apiKey);
  const provider = (process.env.AI_PROVIDER ?? 'ollama').toUpperCase();
  return provider === 'OLLAMA' || provider === 'GPT_OSS' || provider === 'GPT-OSS' || Boolean(process.env.OPENAI_API_KEY);
}
