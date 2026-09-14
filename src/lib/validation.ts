import { z } from 'zod';
import { today } from './finance';
// Upper bound is ₹1 crore per input and under PostgreSQL's signed Int limit.
export const money = z.number().int().min(0).max(1_000_000_000);
const positive = money.refine((v) => v > 0, 'Amount must be positive');
const text = z.string().trim().min(1).max(100);
const notes = z.string().trim().max(500).optional();
const id = z.string().min(1).max(100);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v &&
      v >= '2000-01-01' &&
      v <= '2100-12-31',
    'Enter a valid date',
  );
const postedDate = date.refine((v) => v <= today(), 'Posted transactions cannot be future dated');
export const commandSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('budget'),
    month: z.string().regex(/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/),
    category: text.transform((v) => v.replace(/\s+/g, ' ').toLowerCase()),
    amount: money,
  }),
  z.object({
    kind: z.literal('account'),
    name: text,
    type: z.enum(['BANK', 'CASH', 'SAVINGS', 'INVESTMENT']),
    balance: money,
    spendable: z.boolean(),
  }),
  z
    .object({
      kind: z.literal('income'),
      amount: positive,
      date,
      source: z.enum(['Salary', 'Bonus', 'Side Income', 'Other Income']),
      recurring: z.boolean(),
      status: z.enum(['EXPECTED', 'RECEIVED']),
      accountId: id.optional(),
      notes,
    })
    .refine(
      (v) => v.status !== 'RECEIVED' || (v.accountId && v.date <= today()),
      'Received income needs an account and a non-future date',
    ),
  z.object({ kind: z.literal('receiveIncome'), id, accountId: id, date: postedDate }),
  z
    .object({
      kind: z.literal('expense'),
      amount: positive,
      date: postedDate,
      category: text,
      method: z.enum(['UPI', 'Cash', 'Debit Card', 'Credit Card', 'Bank Transfer']),
      essentiality: z.enum(['MUST HAVE', 'IMPORTANT/FLEXIBLE', 'WANT']),
      accountId: id.optional(),
      cardId: id.optional(),
      description: notes,
    })
    .refine(
      (v) => (v.method === 'Credit Card' ? !!v.cardId && !v.accountId : !!v.accountId && !v.cardId),
      'Choose exactly one funding account or card',
    ),
  z
    .object({
      kind: z.literal('commitment'),
      name: text,
      category: z.enum([
        'Family Support',
        'LIC',
        'Term Insurance',
        'Tuition',
        'SIP',
        'Gold Saving Plan',
        'Mobile Recharge',
        'Household',
        'Subscription',
        'Other',
      ]),
      amount: positive,
      intervalMonths: z.number().int().min(1).max(120),
      dueDate: date,
      funded: money,
      essential: z.boolean(),
    })
    .refine((v) => v.funded <= v.amount, 'Funded reserve cannot exceed payment'),
  z.object({
    kind: z.literal('updateCommitment'),
    id,
    name: text,
    amount: positive,
    funded: money,
    essential: z.boolean(),
    active: z.boolean(),
  }),
  z
    .object({
      kind: z.literal('card'),
      bank: text,
      name: text,
      lastFour: z
        .string()
        .regex(/^\d{4}$/)
        .optional(),
      creditLimit: positive,
      availableLimit: money.nullable(),
      outstanding: money,
      statementAmount: money,
      statementPaid: money,
      statementDate: postedDate,
      dueDate: date,
      minimumDue: money,
      interestBps: z.number().int().min(0).max(10000),
      status: z.enum(['ACTIVE', 'FROZEN', 'CLOSED']),
    })
    .refine(
      (v) =>
        v.statementPaid <= v.statementAmount &&
        v.outstanding >= v.statementAmount - v.statementPaid &&
        v.minimumDue <= v.statementAmount &&
        v.dueDate >= v.statementDate &&
        (v.availableLimit === null || v.availableLimit <= v.creditLimit),
      'Reconcile statement, outstanding, limits and dates',
    ),
  z
    .object({
      kind: z.literal('statement'),
      id,
      statementAmount: money,
      statementDate: postedDate,
      dueDate: date,
      minimumDue: money,
      availableLimit: money.nullable(),
      status: z.enum(['ACTIVE', 'FROZEN', 'CLOSED']),
    })
    .refine(
      (v) => v.minimumDue <= v.statementAmount && v.dueDate >= v.statementDate,
      'Invalid statement dates or minimum due',
    ),
  z
    .object({
      kind: z.literal('emi'),
      newPurchase: z.boolean().optional(),
      purchaseDate: postedDate.optional(),
      cardId: id,
      name: text,
      originalAmount: positive,
      principalRemaining: positive,
      monthlyEmi: positive,
      nextPrincipal: positive,
      nextInterest: money,
      totalInstallments: z.number().int().min(1).max(600),
      installmentsPaid: z.number().int().min(0).max(599),
      nextDate: date,
    })
    .refine(
      (v) =>
        v.principalRemaining <= v.originalAmount &&
        v.nextPrincipal <= v.principalRemaining &&
        v.nextPrincipal + v.nextInterest === v.monthlyEmi &&
        v.installmentsPaid < v.totalInstallments,
      'Reconcile EMI principal, interest and installment count',
    ),
  z.object({
    kind: z.literal('postEmi'),
    id,
    date: postedDate,
    principal: positive,
    interest: money,
  }),
  z.object({ kind: z.literal('emiSchedule'), id, nextPrincipal: positive, nextInterest: money }),
  z
    .object({
      kind: z.literal('payment'),
      accountId: id,
      cardId: id.optional(),
      commitmentId: id.optional(),
      destinationAccountId: id.optional(),
      amount: positive,
      date: postedDate,
      type: z.enum(['STATEMENT', 'UNBILLED', 'COMMITMENT']),
      notes,
    })
    .refine(
      (v) =>
        v.type === 'COMMITMENT' ? !!v.commitmentId && !v.cardId : !!v.cardId && !v.commitmentId,
      'Choose the correct payment target',
    ),
  z.object({
    kind: z.literal('settings'),
    name: text,
    salaryDay: z.number().int().min(1).max(31),
    monthlyIncome: money,
    essentialReserve: money,
    emergencyReserve: money,
    goalReserve: money,
    extraDebtReserve: money,
  }),
]);
export type Command = z.infer<typeof commandSchema>;
