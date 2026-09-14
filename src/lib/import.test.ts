import { describe, expect, it } from 'vitest';
import { parseStatementCsv } from './import';

describe('statement CSV import', () => {
  it('parses quoted fields and exact paise', () => {
    const rows = parseStatementCsv(
      'type,date,amount,description,category,essentiality\nEXPENSE,2026-09-14,12.34,"Tea, snack",Eating Out,WANT',
    );
    expect(rows).toEqual([
      {
        type: 'EXPENSE',
        date: '2026-09-14',
        amount: 1234,
        description: 'Tea, snack',
        category: 'Eating Out',
        essentiality: 'WANT',
      },
    ]);
  });
  it('rejects malformed money and missing columns', () => {
    expect(() => parseStatementCsv('type,date\nINCOME,2026-01-01')).toThrow('Missing CSV column');
    expect(() =>
      parseStatementCsv(
        'type,date,amount,description,category,essentiality\nINCOME,2026-01-01,1.999,x,x,MUST HAVE',
      ),
    ).toThrow('invalid amount');
  });
});
