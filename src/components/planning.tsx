'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { INR, today, type Data } from '@/lib/finance';
import { spendingReport } from '@/lib/planning';
import { requestId } from '@/lib/request-id';

export function Planning({ data, section, demo }: { data: Data; section: string; demo: boolean }) {
  const router = useRouter();
  const [month, setMonth] = useState(today().slice(0, 7));
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const request = useRef<{ body: string; key: string } | null>(null);
  const report = spendingReport(data, month);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (demo) {
      setMessage('Sample data is read-only. Sign in to save a budget.');
      return;
    }
    if (!/^\d+(\.\d{1,2})?$/.test(amount)) {
      setMessage('Enter rupees with up to two decimal places.');
      return;
    }
    const [rupees, paise = ''] = amount.split('.');
    const value = Number(rupees) * 100 + Number(paise.padEnd(2, '0'));
    const body = JSON.stringify({ kind: 'budget', month, category, amount: value });
    if (request.current?.body !== body) request.current = { body, key: requestId() };
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': request.current.key },
        body,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to save budget');
      request.current = null;
      setMessage('Budget saved.');
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Unable to save budget. Retry to confirm.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="planning">
      <label className="planning-month">
        Report month
        <input
          type="month"
          min="2000-01"
          max="2100-12"
          value={month}
          onChange={(e) => {
            if (/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(e.target.value)) {
              setMonth(e.target.value);
              setMessage('');
            }
          }}
        />
      </label>
      <p className="planning-note">
        Based on recorded transactions for the selected calendar month. The current month is
        incomplete. Missing records can affect comparisons.
      </p>
      {section === 'budgets' ? (
        <>
          <div className="planning-cards">
            <Summary label="Category budgets" value={report.totalBudget} />
            <Summary label="Recorded expenses" value={report.total} />
            <Summary label="Spending without a budget" value={report.unbudgeted} />
          </div>
          <form className="planning-budget-form panel" onSubmit={save}>
            <h2>Set a category budget</h2>
            <p>
              Saving the same category updates its limit for this month. Zero means no spending
              planned. Budgets track spending; they do not reserve cash or change safe to spend.
            </p>
            <label>
              Budget category
              <input
                list="budget-categories"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                maxLength={100}
                required
              />
            </label>
            <datalist id="budget-categories">
              {[
                ...new Set([
                  'Groceries',
                  'Fuel',
                  'Travel',
                  'Shopping',
                  'Eating Out',
                  'Medical',
                  'Family',
                  'Education',
                  'Utility',
                  'Entertainment',
                  ...data.expenses.map((e) => e.category),
                ]),
              ].map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <label>
              Monthly budget (INR)
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </label>
            <button className="button primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save budget'}
            </button>
            {message && <p role="status">{message}</p>}
          </form>
          <div className="planning-table-wrap panel">
            <table className="planning-table">
              <caption>Budget versus actual</caption>
              <thead>
                <tr>
                  {['Category', 'Budget', 'Actual', 'Remaining', 'Used', 'Status', ''].map(
                    (h, i) => (
                      <th key={i} scope="col">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.category}>
                    <th scope="row" className="category-name">
                      {r.category}
                    </th>
                    <td>{r.budget === null ? 'Not set' : INR(r.budget)}</td>
                    <td>{INR(r.actual)}</td>
                    <td>{r.variance ? INR(r.variance.difference) : '—'}</td>
                    <td>
                      {r.variance?.percentage == null
                        ? '—'
                        : `${Math.round(r.variance.percentage)}%`}
                    </td>
                    <td>
                      {!r.variance
                        ? 'Information Required'
                        : r.variance.overBudget
                          ? 'Over budget'
                          : (r.variance.percentage ?? 0) >= 90
                            ? '90% or more used'
                            : 'Within budget'}
                    </td>
                    <td>
                      <button
                        className="text-button"
                        aria-label={`Edit budget for ${r.category}`}
                        onClick={() => {
                          setCategory(r.category);
                          setAmount(r.budget === null ? '' : (r.budget / 100).toFixed(2));
                          setMessage('');
                        }}
                      >
                        {r.budget === null ? 'Set budget' : 'Edit'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {report.rows.length === 0 && (
              <p>
                No budgets or expenses recorded for this month. Set your first category budget
                above.
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="planning-cards">
            <Summary label="Recorded expenses" value={report.total} />
            <Summary label="Received income" value={report.income} />
            <Summary label="Wants" value={report.wants} />
            <Summary label="Essential spending" value={report.essential} />
            <Summary label="Important / flexible" value={report.flexible} />
            <Summary label="Family support (included in expenses)" value={report.family} />
            <Summary label="Card purchases and interest" value={report.cardSpending} />
            <Summary label="Card debt payments (not expenses)" value={report.debtPayments} />
            <Summary
              label="Investment contributions (transfers)"
              value={report.investmentTransfers}
            />
          </div>
          <section className="panel planning-insights">
            <h2>Where is my money going?</h2>
            <p>
              Recorded expenses changed by {INR(report.change)} compared with {report.previousMonth}
              {report.percentageChange === null
                ? '. Percentage comparison needs prior-month spending.'
                : ` (${report.percentageChange.toFixed(1)}%).`}
            </p>
            <p>
              Spending marked Want changed by {INR(report.wants - report.priorWants)}. Review these
              purchases for possible savings.
            </p>
            {data.cards.some((c) => c.outstanding > 0) && report.cardSpending > 0 && (
              <p>
                Card spending is recorded in this month and posted debt remains today. Review
                repayment capacity before another purchase.
              </p>
            )}
            <p>
              These categories overlap: card spending and family support are included in expenses.
              Debt payments and investment transfers are shown separately. Investment contributions
              are not investment returns or a complete savings measure.
            </p>
          </section>
          <div className="panel planning-table-wrap">
            <table className="planning-table">
              <caption>Top categories and month comparison</caption>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>{month}</th>
                  <th>{report.previousMonth}</th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.category}>
                    <th className="category-name" scope="row">
                      {r.category}
                    </th>
                    <td>{INR(r.actual)}</td>
                    <td>{INR(r.prior)}</td>
                    <td>{INR(r.change)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {report.rows.length === 0 && <p>No recorded spending for either month.</p>}
          </div>
        </>
      )}
    </div>
  );
}
function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="panel planning-summary">
      <span>{label}</span>
      <strong>{INR(value)}</strong>
    </div>
  );
}
