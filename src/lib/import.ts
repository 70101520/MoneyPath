export type ImportRow = {
  type: 'INCOME' | 'EXPENSE';
  date: string;
  amount: number;
  description: string;
  category: string;
  essentiality: 'MUST HAVE' | 'IMPORTANT/FLEXIBLE' | 'WANT';
};
function fields(line: string) {
  const out: string[] = [];
  let value = '',
    quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      out.push(value.trim());
      value = '';
    } else value += c;
  }
  out.push(value.trim());
  return out;
}
export function parseStatementCsv(text: string): ImportRow[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter(Boolean);
  if (lines.length < 2) throw new Error('CSV needs a header and at least one row.');
  const header = fields(lines[0]).map((v) => v.toLowerCase()),
    required = ['type', 'date', 'amount', 'description', 'category', 'essentiality'];
  for (const h of required) if (!header.includes(h)) throw new Error(`Missing CSV column: ${h}`);
  if (lines.length > 101) throw new Error('Import at most 100 rows at a time.');
  return lines.slice(1).map((line, index) => {
    const values = fields(line),
      get = (h: string) => values[header.indexOf(h)] ?? '',
      type = get('type').toUpperCase(),
      essentiality = get('essentiality').toUpperCase(),
      raw = get('amount');
    if (!['INCOME', 'EXPENSE'].includes(type))
      throw new Error(`Row ${index + 2}: type must be INCOME or EXPENSE.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(get('date')))
      throw new Error(`Row ${index + 2}: use YYYY-MM-DD.`);
    if (!/^\d+(\.\d{1,2})?$/.test(raw)) throw new Error(`Row ${index + 2}: invalid amount.`);
    if (!['MUST HAVE', 'IMPORTANT/FLEXIBLE', 'WANT'].includes(essentiality))
      throw new Error(`Row ${index + 2}: invalid essentiality.`);
    const amount = Math.round(Number(raw) * 100);
    if (amount <= 0 || amount > 1_000_000_000)
      throw new Error(`Row ${index + 2}: amount is outside the supported range.`);
    return {
      type: type as ImportRow['type'],
      date: get('date'),
      amount,
      description: get('description').slice(0, 100),
      category: get('category').slice(0, 100) || 'Other',
      essentiality: essentiality as ImportRow['essentiality'],
    };
  });
}
