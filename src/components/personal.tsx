'use client';
import { useState } from 'react';
import { calculate, dateLabel, INR, today, type Data } from '@/lib/finance';
import { personalStatus } from '@/lib/personal';
import { paise, useSave } from './decisions';

export function PersonalBalances({
  data,
  direction,
  demo,
}: {
  data: Data;
  direction: 'RECEIVABLE' | 'PAYABLE';
  demo: boolean;
}) {
  const receivable = direction === 'RECEIVABLE';
  const [selected, setSelected] = useState<string | null>(null),
    [mode, setMode] = useState<'create' | 'edit' | 'settle' | 'advance'>('create');
  const [generation, setGeneration] = useState(0);
  const { save, busy, message, setMessage } = useSave(demo);
  const entries = (data.personalEntries ?? []).filter((e) => e.direction === direction);
  const entry = entries.find((e) => e.id === selected);
  const s = calculate(data);
  const select = (id: string | null, next: typeof mode) => {
    setSelected(id);
    setMode(next);
    setMessage('');
    setGeneration((n) => n + 1);
  };
  const outstanding = entries.reduce((n, e) => n + e.amount - e.settled, 0);
  const overdue = entries
    .filter((e) => personalStatus(e, today()) === 'Overdue')
    .reduce((n, e) => n + e.amount - e.settled, 0);
  const settled = entries.reduce((n, e) => n + e.settled, 0);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget),
      value = (name: string) => String(form.get(name) ?? '').trim();
    try {
      const command =
        mode === 'settle' || mode === 'advance'
          ? {
              kind: mode === 'advance' ? 'personalAdvance' : 'personalSettlement',
              id: selected,
              accountId: value('accountId'),
              amount: paise(value('amount')),
              date: value('date'),
              notes: value('notes'),
            }
          : {
              kind: mode === 'edit' ? 'personalSchedule' : 'personalEntry',
              ...(mode === 'edit'
                ? { id: selected }
                : {
                    direction,
                    amount: paise(value('amount')),
                    openingSettled: paise(value('openingSettled')),
                    openingDate: value('openingDate'),
                  }),
              reference: value('reference'),
              dueDate: value('dueDate') || null,
              priority: value('priority') || 'NORMAL',
              paymentReserve: receivable
                ? 0
                : value('paymentReserve') === ''
                  ? null
                  : paise(value('paymentReserve')),
              notes: value('notes'),
            };
      if (await save(command)) {
        setSelected(null);
        setMode('create');
        setGeneration((n) => n + 1);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Check your inputs.');
    }
  }
  return (
    <div className="planning personal-balances">
      <section className="panel planning-insights">
        <h2>
          {receivable
            ? 'Expected money is not available cash'
            : 'Keep private debt separate from spending'}
        </h2>
        <p>
          {receivable
            ? 'Add an existing amount owed to you. It is excluded from safe to spend and tracked net worth until received. Use Income for expected salary or new earnings; do not enter the same item in both places.'
            : 'Add an existing private liability. Opening bank balances must already include any borrowing received. This entry does not credit your account. Interest or fees must be recorded separately as expenses.'}
        </p>
        <p>
          Opening amounts are snapshots, including any historical settlement already reflected in
          account balances. Future settlements change the selected account once and reduce the
          outstanding balance. Do not enter them again as income or expenses.
        </p>
        {!receivable && (
          <p>
            A liability due through your next salary reserves its full unpaid amount. For later or
            undated debt, enter a planned cash reserve; blank means Information Required and zero
            explicitly means no reserve. This reserve is separate from the extra card-debt reserve
            in Settings.
          </p>
        )}
      </section>
      <div className="planning-cards">
        {[
          ['Outstanding', outstanding],
          [
            receivable
              ? 'Received (including opening history)'
              : 'Repaid (including opening history)',
            settled,
          ],
          ['Overdue outstanding', overdue],
          ...(!receivable ? [['Current cash reservation', s.privateDebtReserve]] : []),
        ].map(([label, value]) => (
          <div className="panel planning-summary" key={String(label)}>
            <span>{label}</span>
            <strong>{INR(Number(value))}</strong>
          </div>
        ))}
      </div>
      <section className="panel planning-insights">
        <h2>
          {mode === 'advance'
            ? `${receivable ? 'Lend more to' : 'Borrow more from'} · ${entry?.reference ?? ''}`
            : mode === 'settle'
              ? `${receivable ? 'Receive' : 'Repay'} · ${entry?.reference ?? ''}`
              : mode === 'edit'
                ? 'Edit dates and plan'
                : receivable
                  ? 'Add money to receive'
                  : 'Add money I owe'}
        </h2>
        {mode !== 'create' && (
          <button className="text-button" onClick={() => select(null, 'create')}>
            Cancel and add new
          </button>
        )}
        <form key={`${generation}-${direction}`} className="planning-budget-form" onSubmit={submit}>
          {mode === 'settle' || mode === 'advance' ? (
            <>
              <p>
                {mode === 'advance'
                  ? receivable
                    ? 'This lends new money from the selected account and increases the receivable.'
                    : 'This records new borrowing into the selected account and increases the liability.'
                  : `Remaining: ${INR(entry ? entry.amount - entry.settled : 0)}. This is a principal settlement, not new income or expense.`}
              </p>
              <label>
                Settlement amount (INR)
                <input name="amount" inputMode="decimal" required />
              </label>
              <label>
                Settlement date
                <input
                  name="date"
                  type="date"
                  min={entry?.openingDate.slice(0, 10)}
                  max={today()}
                  defaultValue={today()}
                  required
                />
              </label>
              <label>
                Settlement account
                <select name="accountId" required>
                  <option value="">Choose account</option>
                  {data.accounts.map((a) => (
                    <option value={a.id} key={a.id}>
                      {a.name} · {INR(a.balance)}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              <label>
                Person or reference
                <input
                  name="reference"
                  maxLength={100}
                  defaultValue={entry?.reference ?? ''}
                  required
                />
              </label>
              {mode === 'create' && (
                <>
                  <label>
                    Original amount (INR)
                    <input name="amount" inputMode="decimal" required />
                  </label>
                  <label>
                    Already settled at opening (INR)
                    <input name="openingSettled" inputMode="decimal" defaultValue="0" required />
                  </label>
                  <label>
                    Opening snapshot date
                    <input
                      name="openingDate"
                      type="date"
                      max={today()}
                      defaultValue={today()}
                      required
                    />
                  </label>
                </>
              )}
              <label>
                {receivable ? 'Expected receipt date' : 'Agreed repayment date'}
                <input
                  name="dueDate"
                  type="date"
                  min="2000-01-01"
                  max="2100-12-31"
                  defaultValue={entry?.dueDate?.slice(0, 10) ?? ''}
                />
              </label>
              <p>Leave the date blank if none is agreed. No date will be invented.</p>
              {!receivable && (
                <>
                  <label>
                    Repayment priority
                    <select name="priority" defaultValue={entry?.priority ?? 'NORMAL'}>
                      <option value="HIGH">High</option>
                      <option value="NORMAL">Normal</option>
                      <option value="LOW">Low</option>
                    </select>
                  </label>
                  <label>
                    Planned cash reserve (INR)
                    <input
                      name="paymentReserve"
                      inputMode="decimal"
                      defaultValue={
                        entry?.paymentReserve == null ? '' : String(entry.paymentReserve / 100)
                      }
                    />
                  </label>
                </>
              )}
            </>
          )}
          <label>
            Private notes
            <textarea
              name="notes"
              maxLength={500}
              defaultValue={mode === 'settle' || mode === 'advance' ? '' : (entry?.notes ?? '')}
            />
          </label>
          <button className="button primary" disabled={busy}>
            {busy
              ? 'Saving…'
              : mode === 'advance'
                ? receivable
                  ? 'Record lending'
                  : 'Record borrowing'
                : mode === 'settle'
                  ? receivable
                    ? 'Record receipt'
                    : 'Record repayment'
                  : mode === 'edit'
                    ? 'Save dates and plan'
                    : 'Save opening balance'}
          </button>
          {message && <p role="status">{message}</p>}
        </form>
      </section>
      {entries.length === 0 && (
        <section className="panel planning-insights">
          <p>No {receivable ? 'receivables' : 'private liabilities'} recorded yet.</p>
        </section>
      )}
      {entries.map((e) => (
        <section key={e.id} className="panel planning-insights">
          <h2>{e.reference}</h2>
          <p>
            {personalStatus(e, today())} · Remaining {INR(e.amount - e.settled)} of {INR(e.amount)}
          </p>
          <p>
            {e.dueDate
              ? `${receivable ? 'Expected' : 'Due'} ${dateLabel(e.dueDate)}`
              : 'No date agreed'}
            {!receivable
              ? ` · ${e.priority} priority · Planned reserve ${e.paymentReserve === null ? 'Information Required' : INR(e.paymentReserve)}`
              : ''}
          </p>
          {e.notes && <p>{e.notes}</p>}
          <div className="heading-actions">
            <button className="text-button" onClick={() => select(e.id, 'edit')}>
              Edit plan for {e.reference}
            </button>
            {e.settled < e.amount && (
              <button className="button primary" onClick={() => select(e.id, 'settle')}>
                {receivable ? 'Receive from' : 'Repay'} {e.reference}
              </button>
            )}
            <button className="text-button" onClick={() => select(e.id, 'advance')}>
              {receivable ? 'Lend more' : 'Borrow more'} →
            </button>
          </div>
          <details>
            <summary>Settlement history</summary>
            <p>
              Opening settled amount: {INR(e.openingSettled)} as of {dateLabel(e.openingDate)}; no
              new cash movement.
            </p>
            {(data.settlements ?? [])
              .filter((p) => p.entryId === e.id)
              .map((p) => (
                <p key={p.id}>
                  {dateLabel(p.date)} · {INR(p.amount)} ·{' '}
                  {data.accounts.find((a) => a.id === p.accountId)?.name}{' '}
                  {p.notes ? `· ${p.notes}` : ''}
                </p>
              ))}
          </details>
        </section>
      ))}
    </div>
  );
}
