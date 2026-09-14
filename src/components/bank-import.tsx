'use client';
import { useState } from 'react';
import { INR, type Data } from '@/lib/finance';
import { parseStatementCsv, type ImportRow } from '@/lib/import';
import { requestId } from '@/lib/request-id';
export function BankImport({ data, demo }: { data: Data; demo: boolean }) {
  const [rows, setRows] = useState<ImportRow[]>([]),
    [accountId, setAccountId] = useState(''),
    [message, setMessage] = useState('');
  async function file(f?: File) {
    if (!f) return;
    try {
      setRows(parseStatementCsv(await f.text()));
      setMessage('Review the preview before importing.');
    } catch (e) {
      setRows([]);
      setMessage(e instanceof Error ? e.message : 'Invalid CSV.');
    }
  }
  async function run() {
    if (demo) {
      setMessage('Sample data is read-only.');
      return;
    }
    if (!accountId || !rows.length) {
      setMessage('Choose an account and valid CSV.');
      return;
    }
    const r = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId: requestId(), accountId, rows }),
      }),
      j = await r.json();
    setMessage(r.ok ? `${j.imported} rows imported. Reloading…` : j.error);
    if (r.ok) setTimeout(() => location.reload(), 700);
  }
  return (
    <section className="panel planning-insights">
      <h2>Bank statement CSV import</h2>
      <p>
        Use columns: <code>type,date,amount,description,category,essentiality</code>. Type is INCOME
        or EXPENSE; dates use YYYY-MM-DD. Review up to 100 rows. Imports are resumable and
        idempotent, and every row uses the normal accounting rules.
      </p>
      <div className="planning-budget-form">
        <label>
          Account
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Choose account</option>
            {data.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {INR(a.balance)}
              </option>
            ))}
          </select>
        </label>
        <label>
          CSV file
          <input type="file" accept=".csv,text/csv" onChange={(e) => file(e.target.files?.[0])} />
        </label>
        {rows.length > 0 && (
          <>
            <p>
              {rows.length} row(s) ready · total {INR(rows.reduce((n, r) => n + r.amount, 0))}
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map((r, i) => (
                    <tr key={i}>
                      <td>{r.type}</td>
                      <td>{r.date}</td>
                      <td>{r.description}</td>
                      <td>{INR(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="button primary" onClick={run}>
              Import reviewed rows
            </button>
          </>
        )}
        {message && <p role="status">{message}</p>}
      </div>
    </section>
  );
}
