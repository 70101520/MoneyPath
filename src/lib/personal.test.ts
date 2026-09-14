import { describe, expect, it } from 'vitest';
import { personalStatus, personalSummary, type PersonalEntryData } from './personal';
import { calculate } from './finance';
import { sampleData } from './sample';
import { commandSchema } from './validation';
const entry: PersonalEntryData = {
  id: 'personal',
  direction: 'PAYABLE',
  reference: 'Test',
  amount: 100000,
  openingSettled: 0,
  settled: 20000,
  openingDate: '2026-09-01',
  dueDate: null,
  priority: 'HIGH',
  paymentReserve: null,
  notes: null,
};
describe('Private balances and reservations', () => {
  it('never counts expected receivables as available cash or cash reservations', () => {
    const data = sampleData('2026-09-14');
    const before = calculate(data, '2026-09-14');
    data.personalEntries = [{ ...entry, direction: 'RECEIVABLE' }];
    const after = calculate(data, '2026-09-14');
    expect(after.cash).toBe(before.cash);
    expect(after.safe).toEqual(before.safe);
    expect(after.expectedReceivables).toBe(80000);
    expect(after.privateDebt).toBe(0);
  });
  it('requires an explicit reserve for undated/future liabilities and distinguishes zero', () => {
    expect(personalSummary([entry], '2026-09-14', '2026-10-10').required).toHaveLength(1);
    expect(
      personalSummary([{ ...entry, paymentReserve: 0 }], '2026-09-14', '2026-10-10').required,
    ).toHaveLength(0);
    expect(
      personalSummary([{ ...entry, paymentReserve: 20000 }], '2026-09-14', '2026-10-10').reserve,
    ).toBe(20000);
  });
  it('reserves full due principal instead of adding the manual reserve twice', () => {
    const summary = personalSummary(
      [{ ...entry, dueDate: '2026-09-15', paymentReserve: 20000 }],
      '2026-09-14',
      '2026-10-10',
    );
    expect(summary.reserve).toBe(80000);
    expect(summary.liabilities).toBe(80000);
    expect(summary.obligations[0].amount).toBe(80000);
  });
  it('classifies settled, partial and overdue balances without inventing dates', () => {
    expect(personalStatus(entry, '2026-09-14')).toBe('Partially settled');
    expect(personalStatus({ ...entry, dueDate: '2026-09-13' }, '2026-09-14')).toBe('Overdue');
    expect(personalStatus({ ...entry, settled: 100000, dueDate: '2026-09-13' }, '2026-09-14')).toBe(
      'Settled',
    );
    expect(personalSummary([entry], '2026-09-14', '2026-10-10').obligations).toHaveLength(0);
  });
  it('includes private liabilities in debt-income risk without inflating card utilization', () => {
    const data = sampleData('2026-09-14');
    data.personalEntries = [{ ...entry, amount: 5000000, paymentReserve: 0 }];
    const result = calculate(data, '2026-09-14');
    expect(result.totalDebt).toBe(result.debt + 4980000);
    expect(result.riskVersion).toBe('personal-v3');
    expect(result.risk.rules.find((r) => r.id === 'debt-income')?.reason).toContain('private debt');
  });
  it('validates opening settlement and planned reserves against the nominal balance', () => {
    const command = {
      kind: 'personalEntry',
      direction: 'PAYABLE',
      reference: 'Test',
      amount: 100,
      openingSettled: 90,
      openingDate: '2026-01-01',
      dueDate: null,
      priority: 'NORMAL',
      paymentReserve: 20,
    };
    expect(commandSchema.safeParse(command).success).toBe(false);
    expect(commandSchema.safeParse({ ...command, paymentReserve: 10 }).success).toBe(true);
  });
});
