import { db } from './db';
import { Prisma } from '@/generated/prisma/client';
import { addMonths, calculate, cardPayment, day, postEmi, type Data } from './finance';
import { encrypt, decrypt, tokenHash } from './security';
import type { Command } from './validation';
type Tx = Prisma.TransactionClient;
export async function readData(userId: string, tx: Tx = db): Promise<Data> {
  const [user, accounts, incomes, commitments, cards, expenses, payments, budgets] =
    await Promise.all([
      tx.user.findUniqueOrThrow({ where: { id: userId } }),
      tx.account.findMany({ where: { userId }, orderBy: { name: 'asc' } }),
      tx.income.findMany({ where: { userId }, orderBy: { date: 'desc' } }),
      tx.commitment.findMany({ where: { userId }, orderBy: { dueDate: 'asc' } }),
      tx.card.findMany({
        where: { userId },
        include: { emis: true, statements: { orderBy: { statementDate: 'desc' }, take: 12 } },
        orderBy: { bank: 'asc' },
      }),
      tx.expense.findMany({ where: { userId }, orderBy: { date: 'desc' } }),
      tx.payment.findMany({ where: { userId }, orderBy: { date: 'desc' } }),
      tx.budget.findMany({ where: { userId }, orderBy: [{ month: 'desc' }, { category: 'asc' }] }),
    ]);
  const settings = {
    name: user.name,
    salaryDay: user.salaryDay,
    monthlyIncome: user.monthlyIncome,
    essentialReserve: user.essentialReserve,
    emergencyReserve: user.emergencyReserve,
    goalReserve: user.goalReserve,
    extraDebtReserve: user.extraDebtReserve,
  };
  return JSON.parse(
    JSON.stringify({
      settings,
      budgets,
      accounts,
      commitments,
      incomes: incomes.map((i) => ({ ...i, notes: decrypt(i.notes) })),
      cards: cards.map((c) => ({ ...c, lastFour: decrypt(c.lastFour) })),
      expenses: expenses.map((e) => ({ ...e, description: decrypt(e.description) })),
      payments: payments.map((p) => ({ ...p, notes: decrypt(p.notes) })),
    }),
  );
}
export async function execute(userId: string, requestId: string, command: Command) {
  const requestHash = tokenHash(JSON.stringify(command));
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          const prior = await tx.audit.findUnique({ where: { requestId } });
          if (prior) {
            if (prior.userId !== userId || prior.requestHash !== requestHash)
              throw new Error('Request conflict: use a new request key for a different command');
            return { id: prior.entityId, duplicate: true };
          }
          const account = async (id: string) =>
            tx.account.findFirstOrThrow({ where: { id, userId } });
          const card = async (id: string) => tx.card.findFirstOrThrow({ where: { id, userId } });
          const debit = async (id: string, amount: number) => {
            const a = await account(id);
            if (a.balance < amount) throw new Error('Insufficient account balance');
            await tx.account.update({ where: { id }, data: { balance: { decrement: amount } } });
          };
          let entityId = userId;
          const c = command;
          switch (c.kind) {
            case 'budget': {
              const category = c.category.trim().replace(/\s+/g, ' ').toLowerCase();
              const row = await tx.budget.upsert({
                where: { userId_month_category: { userId, month: c.month, category } },
                create: { userId, month: c.month, category, amount: c.amount },
                update: { amount: c.amount },
              });
              entityId = row.id;
              break;
            }
            case 'account': {
              const row = await tx.account.create({
                data: {
                  userId,
                  name: c.name,
                  kind: c.type,
                  balance: c.balance,
                  spendable: c.spendable,
                },
              });
              entityId = row.id;
              break;
            }
            case 'income': {
              if (c.status === 'RECEIVED') {
                await account(c.accountId!);
                await tx.account.update({
                  where: { id: c.accountId! },
                  data: { balance: { increment: c.amount } },
                });
              }
              const row = await tx.income.create({
                data: {
                  userId,
                  amount: c.amount,
                  date: day(c.date),
                  source: c.source,
                  recurring: c.recurring,
                  status: c.status,
                  accountId: c.status === 'RECEIVED' ? c.accountId : null,
                  notes: encrypt(c.notes),
                },
              });
              entityId = row.id;
              break;
            }
            case 'receiveIncome': {
              const i = await tx.income.findFirstOrThrow({
                where: { id: c.id, userId, status: 'EXPECTED' },
              });
              await account(c.accountId);
              await tx.account.update({
                where: { id: c.accountId },
                data: { balance: { increment: i.amount } },
              });
              await tx.income.update({
                where: { id: c.id },
                data: { status: 'RECEIVED', date: day(c.date), accountId: c.accountId },
              });
              entityId = c.id;
              break;
            }
            case 'expense': {
              if (c.cardId) {
                const target = await card(c.cardId);
                if (target.status !== 'ACTIVE') throw new Error('Card is not active');
                await tx.card.update({
                  where: { id: c.cardId },
                  data: { outstanding: { increment: c.amount }, availableLimit: null },
                });
              } else await debit(c.accountId!, c.amount);
              const row = await tx.expense.create({
                data: {
                  userId,
                  amount: c.amount,
                  date: day(c.date),
                  category: c.category,
                  method: c.method,
                  essentiality: c.essentiality,
                  accountId: c.accountId,
                  cardId: c.cardId,
                  description: encrypt(c.description),
                },
              });
              entityId = row.id;
              break;
            }
            case 'commitment': {
              const row = await tx.commitment.create({
                data: {
                  userId,
                  name: c.name,
                  category: c.category,
                  amount: c.amount,
                  intervalMonths: c.intervalMonths,
                  dueDate: day(c.dueDate),
                  anchorDay: day(c.dueDate).getUTCDate(),
                  funded: c.funded,
                  essential: c.essential,
                },
              });
              entityId = row.id;
              break;
            }
            case 'updateCommitment': {
              const row = await tx.commitment.findFirstOrThrow({ where: { id: c.id, userId } });
              if (c.amount < row.paid + c.funded)
                throw new Error('Amount must cover paid and funded amounts');
              await tx.commitment.update({
                where: { id: c.id },
                data: {
                  name: c.name,
                  amount: c.amount,
                  funded: c.funded,
                  essential: c.essential,
                  active: c.active,
                },
              });
              entityId = c.id;
              break;
            }
            case 'card': {
              const { kind, lastFour, ...fields } = c;
              void kind;
              const row = await tx.card.create({
                data: {
                  ...fields,
                  userId,
                  lastFour: encrypt(lastFour),
                  statementDate: day(c.statementDate),
                  dueDate: day(c.dueDate),
                },
              });
              entityId = row.id;
              break;
            }
            case 'statement': {
              const target = await card(c.id);
              const carriedBalance = target.statementAmount - target.statementPaid;
              if (
                c.statementAmount > target.outstanding ||
                c.statementAmount < carriedBalance ||
                day(c.statementDate) <= target.statementDate ||
                (c.availableLimit !== null && c.availableLimit > target.creditLimit)
              )
                throw new Error('Reconcile statement amount, date or credit limit');
              await tx.cardStatement.create({
                data: {
                  cardId: c.id,
                  amount: target.statementAmount,
                  paid: target.statementPaid,
                  statementDate: target.statementDate,
                  dueDate: target.dueDate,
                },
              });
              await tx.card.update({
                where: { id: c.id },
                data: {
                  statementAmount: c.statementAmount,
                  statementPaid: 0,
                  carriedBalance,
                  carriedDueDate:
                    carriedBalance > 0 ? (target.carriedDueDate ?? target.dueDate) : null,
                  statementDate: day(c.statementDate),
                  dueDate: day(c.dueDate),
                  minimumDue: c.minimumDue,
                  availableLimit: c.availableLimit,
                  status: c.status,
                },
              });
              entityId = c.id;
              break;
            }
            case 'emi': {
              const target = await card(c.cardId);
              const { kind, newPurchase, purchaseDate, ...fields } = c;
              void kind;
              if (newPurchase) {
                if (
                  target.status !== 'ACTIVE' ||
                  c.principalRemaining !== c.originalAmount ||
                  c.installmentsPaid !== 0 ||
                  !purchaseDate
                )
                  throw new Error(
                    'A new financed purchase needs an active card, purchase date, full principal and zero posted installments',
                  );
                await tx.expense.create({
                  data: {
                    userId,
                    cardId: c.cardId,
                    amount: c.originalAmount,
                    date: day(purchaseDate),
                    category: 'EMI purchase',
                    method: 'Credit Card',
                    essentiality: 'IMPORTANT/FLEXIBLE',
                    description: encrypt(c.name),
                  },
                });
              }
              const row = await tx.emi.create({
                data: {
                  ...fields,
                  nextDate: day(c.nextDate),
                  anchorDay: day(c.nextDate).getUTCDate(),
                },
              });
              entityId = row.id;
              break;
            }
            case 'emiSchedule': {
              const e = await tx.emi.findFirstOrThrow({ where: { id: c.id, card: { userId } } });
              if (c.nextPrincipal > e.principalRemaining)
                throw new Error('Principal exceeds the remaining EMI liability');
              await tx.emi.update({
                where: { id: c.id },
                data: {
                  nextPrincipal: c.nextPrincipal,
                  nextInterest: c.nextInterest,
                  monthlyEmi: c.nextPrincipal + c.nextInterest,
                },
              });
              entityId = c.id;
              break;
            }
            case 'postEmi': {
              const e = await tx.emi.findFirstOrThrow({ where: { id: c.id, card: { userId } } });
              if (day(c.date) < e.nextDate) throw new Error('Installment is not due yet');
              if (e.installmentsPaid >= e.totalInstallments)
                throw new Error('All installments are posted');
              const result = postEmi(e.principalRemaining, c.principal, c.interest);
              if (e.installmentsPaid + 1 === e.totalInstallments && result.principalRemaining !== 0)
                throw new Error('Final installment must settle the principal');
              if (result.principalRemaining === 0 && e.installmentsPaid + 1 !== e.totalInstallments)
                throw new Error(
                  'Use the scheduled installment count; early closure is not supported',
                );
              await tx.emi.update({
                where: { id: c.id },
                data: {
                  principalRemaining: result.principalRemaining,
                  installmentsPaid: { increment: 1 },
                  nextDate: addMonths(e.nextDate, 1, e.anchorDay),
                  nextPrincipal: 0,
                  nextInterest: 0,
                },
              });
              await tx.card.update({
                where: { id: e.cardId },
                data: {
                  outstanding: { increment: result.outstandingIncrease },
                  availableLimit: null,
                },
              });
              if (result.expense)
                await tx.expense.create({
                  data: {
                    userId,
                    cardId: e.cardId,
                    amount: result.expense,
                    date: day(c.date),
                    category: 'Interest',
                    method: 'Credit Card',
                    essentiality: 'MUST HAVE',
                  },
                });
              entityId = c.id;
              break;
            }
            case 'payment': {
              if (c.cardId) {
                const target = await card(c.cardId);
                const a = await account(c.accountId);
                const result = cardPayment(target, c.amount, c.type, a.balance);
                await debit(c.accountId, c.amount);
                await tx.card.update({
                  where: { id: c.cardId },
                  data: {
                    outstanding: result.outstanding,
                    statementPaid: result.statementPaid,
                    carriedBalance:
                      c.type === 'STATEMENT'
                        ? Math.max(0, target.carriedBalance - c.amount)
                        : target.carriedBalance,
                    carriedDueDate:
                      c.type === 'STATEMENT' && c.amount >= target.carriedBalance
                        ? null
                        : target.carriedDueDate,
                    availableLimit: null,
                  },
                });
              } else {
                const target = await tx.commitment.findFirstOrThrow({
                  where: { id: c.commitmentId!, userId, active: true },
                });
                if (c.amount > target.amount - target.paid)
                  throw new Error('Payment exceeds this commitment occurrence');
                await debit(c.accountId, c.amount);
                if (['SIP', 'Gold Saving Plan'].includes(target.category)) {
                  if (!c.destinationAccountId || c.destinationAccountId === c.accountId)
                    throw new Error('Choose a separate investment destination account');
                  await account(c.destinationAccountId);
                  await tx.account.update({
                    where: { id: c.destinationAccountId },
                    data: { balance: { increment: c.amount } },
                  });
                } else
                  await tx.expense.create({
                    data: {
                      userId,
                      accountId: c.accountId,
                      amount: c.amount,
                      date: day(c.date),
                      category: target.category,
                      method: 'Bank Transfer',
                      essentiality: target.essential ? 'MUST HAVE' : 'IMPORTANT/FLEXIBLE',
                      description: encrypt(target.name),
                    },
                  });
                const settled = target.paid + c.amount === target.amount;
                await tx.commitment.update({
                  where: { id: target.id },
                  data: {
                    paid: settled ? 0 : target.paid + c.amount,
                    funded: settled ? 0 : Math.max(0, target.funded - c.amount),
                    dueDate: settled
                      ? addMonths(target.dueDate, target.intervalMonths, target.anchorDay)
                      : target.dueDate,
                  },
                });
              }
              const row = await tx.payment.create({
                data: {
                  userId,
                  accountId: c.accountId,
                  cardId: c.cardId,
                  commitmentId: c.commitmentId,
                  destinationAccountId: c.destinationAccountId,
                  amount: c.amount,
                  date: day(c.date),
                  type: c.type,
                  notes: encrypt(c.notes),
                },
              });
              entityId = row.id;
              break;
            }
            case 'settings': {
              const { kind, ...settings } = c;
              void kind;
              await tx.user.update({ where: { id: userId }, data: settings });
              break;
            }
          }
          await tx.audit.create({
            data: { userId, requestId, requestHash, action: c.kind, entityId },
          });
          const result = calculate(await readData(userId, tx));
          await tx.riskSnapshot.create({
            data: { userId, score: result.risk.score, rules: result.risk.rules },
          });
          return { id: entityId, duplicate: false };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2034', 'P2002'].includes(error.code) &&
        attempt < 2
      )
        continue;
      throw error;
    }
  }
}
