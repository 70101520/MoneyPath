import 'dotenv/config';
import { db } from '../src/lib/db';
import { sampleData } from '../src/lib/sample';
import { encrypt } from '../src/lib/security';
import { calculate, day } from '../src/lib/finance';
import { randomUUID } from 'node:crypto';
async function main() {
  if (process.env.SEED_SAMPLE_DATA !== 'yes')
    throw new Error('Set SEED_SAMPLE_DATA=yes to deliberately load sample balances.');
  const user = await db.user.findUnique({ where: { ownerKey: 'owner' } });
  if (!user) throw new Error('Create the owner account in the application first.');
  const sample = sampleData();
  await db.$transaction(async (tx) => {
    if (
      (await tx.account.count({ where: { userId: user.id } })) ||
      (await tx.card.count({ where: { userId: user.id } })) ||
      (await tx.income.count({ where: { userId: user.id } })) ||
      (await tx.commitment.count({ where: { userId: user.id } }))
    )
      throw new Error('Sample seed requires an empty workspace.');
    await tx.user.update({ where: { id: user.id }, data: { ...sample.settings, name: user.name } });
    const ids = new Map<string, string>();
    const mapped = (id: string | null) => (id ? ids.get(id)! : null);
    for (const a of sample.accounts) {
      const { id, ...fields } = a;
      const row = await tx.account.create({ data: { ...fields, userId: user.id } });
      ids.set(id, row.id);
    }
    for (const c of sample.commitments) {
      const { id, ...fields } = c;
      const row = await tx.commitment.create({
        data: { ...fields, userId: user.id, dueDate: day(c.dueDate) },
      });
      ids.set(id, row.id);
    }
    for (const c of sample.cards) {
      const { id, emis, statements, carriedDueDate, ...fields } = c;
      void statements;
      const row = await tx.card.create({
        data: {
          ...fields,
          userId: user.id,
          lastFour: encrypt(c.lastFour),
          statementDate: day(c.statementDate),
          dueDate: day(c.dueDate),
          carriedDueDate: carriedDueDate ? day(carriedDueDate) : null,
        },
      });
      ids.set(id, row.id);
      for (const e of emis) {
        const { id: emiId, ...ef } = e;
        void emiId;
        await tx.emi.create({ data: { ...ef, cardId: row.id, nextDate: day(e.nextDate) } });
      }
    }
    for (const i of sample.incomes) {
      const { id, ...fields } = i;
      void id;
      await tx.income.create({
        data: {
          ...fields,
          userId: user.id,
          accountId: mapped(i.accountId),
          date: day(i.date),
          notes: encrypt(i.notes),
        },
      });
    }
    for (const e of sample.expenses) {
      const { id, ...fields } = e;
      void id;
      await tx.expense.create({
        data: {
          ...fields,
          userId: user.id,
          accountId: mapped(e.accountId),
          cardId: mapped(e.cardId),
          date: day(e.date),
          description: encrypt(e.description),
        },
      });
    }
    for (const p of sample.payments) {
      const { id, ...fields } = p;
      void id;
      await tx.payment.create({
        data: {
          ...fields,
          userId: user.id,
          accountId: mapped(p.accountId)!,
          cardId: mapped(p.cardId),
          commitmentId: mapped(p.commitmentId),
          date: day(p.date),
          notes: encrypt(p.notes),
        },
      });
    }
    await tx.audit.create({
      data: { userId: user.id, requestId: randomUUID(), action: 'sample.seed', entityId: user.id },
    });
    const summary = calculate(sample);
    await tx.riskSnapshot.create({
      data: { userId: user.id, score: summary.risk.score, rules: summary.risk.rules },
    });
  });
  console.log(
    'Sample records loaded. The editable salary is INR 55,000, normally received on day 10.',
  );
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
