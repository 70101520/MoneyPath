import { currentUser } from '@/lib/auth';
import { readData } from '@/lib/service';
import { calculate } from '@/lib/finance';

const xml = (v: unknown) =>
  String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
const cell = (v: unknown, number = false) =>
  `<Cell><Data ss:Type="${number ? 'Number' : 'String'}">${xml(typeof v === 'string' && /^[=+@\-\t\r]/.test(v) ? "'" + v : v)}</Data></Cell>`;
const sheet = (name: string, rows: unknown[][], numeric: number[] = []) =>
  `<Worksheet ss:Name="${xml(name)}"><Table>${rows.map((r) => `<Row>${r.map((v, i) => cell(v, numeric.includes(i))).join('')}</Row>`).join('')}</Table></Worksheet>`;

export async function GET() {
  const user = await currentUser();
  if (!user) return new Response('Sign in required', { status: 401 });
  const data = await readData(user.id),
    summary = calculate(data);
  const transactions: unknown[][] = [['Type', 'Date', 'Description', 'Amount INR']];
  data.incomes.forEach((i) =>
    transactions.push(['Income ' + i.status, i.date.slice(0, 10), i.source, i.amount / 100]),
  );
  data.expenses.forEach((e) =>
    transactions.push([
      'Expense',
      e.date.slice(0, 10),
      e.description ?? e.category,
      e.amount / 100,
    ]),
  );
  data.payments.forEach((p) =>
    transactions.push([
      'Liability/commitment payment',
      p.date.slice(0, 10),
      p.notes ?? p.type,
      p.amount / 100,
    ]),
  );
  (data.settlements ?? []).forEach((p) =>
    transactions.push([
      'Private principal settlement',
      p.date.slice(0, 10),
      p.notes ?? '',
      p.amount / 100,
    ]),
  );
  (data.cashAdvances ?? []).forEach((entry) =>
    transactions.push([
      'Credit-card cash advance (new debt, not income)',
      entry.date.slice(0, 10),
      entry.notes ?? '',
      entry.amount / 100,
    ]),
  );
  const investments: unknown[][] = [
    [
      'Name',
      'Type',
      'Contributed INR',
      'Current value INR',
      'Gain/loss INR',
      'Monthly INR',
      'Next contribution',
      'Maturity',
      'Liquid',
    ],
  ];
  (data.investments ?? []).forEach((i) =>
    investments.push([
      i.name,
      i.kind,
      i.contributed / 100,
      i.currentValue / 100,
      (i.currentValue - i.contributed) / 100,
      i.monthlyContribution / 100,
      i.nextContribution?.slice(0, 10) ?? '',
      i.maturityDate?.slice(0, 10) ?? '',
      i.liquid ? 'Yes' : 'No',
    ]),
  );
  const goals: unknown[][] = [
    ['Name', 'Type', 'Target date', 'Required INR', 'Confirmed INR', 'Expected INR'],
  ];
  (data.goals ?? []).forEach((g) =>
    goals.push([
      g.name,
      g.kind,
      g.targetDate.slice(0, 10),
      (g.familyContribution +
        g.personalCash +
        g.engagement +
        g.travel +
        g.shopping +
        g.emergencyBuffer +
        g.otherAmount) /
        100,
      (g.alreadySaved + g.confirmedMoney) / 100,
      g.expectedMoney / 100,
    ]),
  );
  const summaryRows: unknown[][] = [
    ['Metric', 'INR'],
    ['Available cash', summary.cash / 100],
    [
      'Safe to spend',
      summary.safe.available === null ? 'Information Required' : summary.safe.available / 100,
    ],
    ['Card debt', summary.debt / 100],
    ['Private debt', summary.privateDebt / 100],
    ['Investment value', summary.investmentValue / 100],
  ];
  const body = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${sheet('Summary', summaryRows, [1])}${sheet('Transactions', transactions, [3])}${sheet('Investments', investments, [2, 3, 4, 5])}${sheet('Goals', goals, [3, 4, 5])}</Workbook>`;
  return new Response('\uFEFF' + body, {
    headers: {
      'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
      'Content-Disposition': 'attachment; filename="moneypath-export.xml"',
      'Cache-Control': 'no-store',
    },
  });
}
