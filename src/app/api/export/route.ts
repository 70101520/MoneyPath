import { currentUser } from '@/lib/auth';
import { readData } from '@/lib/service';
import { dateLabel } from '@/lib/finance';
export async function GET() {
  const user = await currentUser();
  if (!user) return new Response('Sign in required', { status: 401 });
  const data = await readData(user.id);
  const quote = (v: unknown) =>
    '"' +
    String(v ?? '')
      .replace(/^[=+@\-\t\r]/, "'" + '$&')
      .replaceAll('"', '""') +
    '"';
  const rows: unknown[][] = [
    ['Type', 'Date', 'Description', 'Amount INR', 'Category / allocation', 'Payment method'],
  ];
  data.incomes.forEach((i) =>
    rows.push(['Income ' + i.status, dateLabel(i.date), i.source, i.amount / 100, '', '']),
  );
  data.expenses.forEach((e) =>
    rows.push(['Expense', dateLabel(e.date), e.description, e.amount / 100, e.category, e.method]),
  );
  data.payments.forEach((p) =>
    rows.push([
      'Payment (not an additional expense)',
      dateLabel(p.date),
      p.notes,
      p.amount / 100,
      p.type,
      'Bank transfer',
    ]),
  );
  return new Response('\uFEFF' + rows.map((r) => r.map(quote).join(',')).join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="moneypath-transactions.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
