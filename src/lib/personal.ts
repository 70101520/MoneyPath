export type PersonalEntryData = {
  id: string;
  direction: 'RECEIVABLE' | 'PAYABLE';
  reference: string;
  amount: number;
  openingSettled: number;
  settled: number;
  openingDate: string;
  dueDate: string | null;
  priority: 'HIGH' | 'NORMAL' | 'LOW';
  paymentReserve: number | null;
  notes: string | null;
};
export type SettlementData = {
  id: string;
  entryId: string;
  accountId: string;
  amount: number;
  date: string;
  notes: string | null;
};
export function personalSummary(
  entries: PersonalEntryData[],
  asOf: string,
  horizon: string | null,
) {
  let receivables = 0,
    liabilities = 0,
    reserve = 0;
  const required: string[] = [];
  const obligations: {
    id: string;
    name: string;
    kind: string;
    amount: number;
    date: string;
    essential: boolean;
    days: number;
  }[] = [];
  for (const entry of entries) {
    const remaining = entry.amount - entry.settled;
    if (remaining <= 0) continue;
    if (entry.direction === 'RECEIVABLE') {
      receivables += remaining;
      continue;
    }
    liabilities += remaining;
    const due = entry.dueDate?.slice(0, 10);
    if (due)
      obligations.push({
        id: entry.id,
        name: entry.reference,
        kind: 'Private liability',
        amount: remaining,
        date: due,
        essential: true,
        days: Math.round((Date.parse(due) - Date.parse(asOf)) / 86400000),
      });
    if (due && horizon && due <= horizon) reserve += remaining;
    else if (entry.paymentReserve === null) required.push('private liability payment reserve');
    else reserve += Math.min(entry.paymentReserve, remaining);
  }
  return { receivables, liabilities, reserve, required: [...new Set(required)], obligations };
}
export function personalStatus(entry: PersonalEntryData, asOf: string) {
  if (entry.settled === entry.amount) return 'Settled';
  if (entry.dueDate && entry.dueDate.slice(0, 10) < asOf) return 'Overdue';
  if (entry.settled > 0) return 'Partially settled';
  return entry.direction === 'RECEIVABLE' ? 'Expected' : 'Unpaid';
}
