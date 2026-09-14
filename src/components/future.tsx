'use client';
import { useState } from 'react';
import { INR, dateLabel, today, type Data, type GoalData } from '@/lib/finance';
import { goalSummary, simulatePlan } from '@/lib/goals';
import { paise, useSave } from './decisions';

const value = (f: FormData, key: string) => String(f.get(key) ?? '').trim();
const amount = (f: FormData, key: string) => paise(value(f, key) || '0');

export function FuturePlanning({
  data,
  section,
  demo,
}: {
  data: Data;
  section: string;
  demo: boolean;
}) {
  return section === 'investments' ? (
    <Investments data={data} demo={demo} />
  ) : section === 'goals' ? (
    <Goals data={data} demo={demo} />
  ) : (
    <WhatIf data={data} />
  );
}

function Investments({ data, demo }: { data: Data; demo: boolean }) {
  const { save, busy, message, setMessage } = useSave(demo);
  const [selected, setSelected] = useState('');
  const investments = data.investments ?? [];
  const total = investments.reduce((n, i) => n + i.currentValue, 0);
  const contributed = investments.reduce((n, i) => n + i.contributed, 0);
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await save({
        kind: 'investment',
        name: value(f, 'name'),
        investmentKind: value(f, 'investmentKind'),
        contributed: amount(f, 'contributed'),
        currentValue: amount(f, 'currentValue'),
        monthlyContribution: amount(f, 'monthlyContribution'),
        nextContribution: value(f, 'nextContribution') || null,
        maturityDate: value(f, 'maturityDate') || null,
        liquid: f.get('liquid') === 'on',
        notes: value(f, 'notes'),
      });
    } catch (x) {
      setMessage(x instanceof Error ? x.message : 'Check amounts.');
    }
  }
  async function event(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      eventKind = value(f, 'eventKind');
    try {
      await save({
        kind: 'investmentEvent',
        id: selected,
        eventKind,
        accountId: eventKind === 'VALUATION' ? null : value(f, 'accountId'),
        amount: amount(f, 'amount'),
        date: value(f, 'date'),
        notes: value(f, 'notes'),
      });
    } catch (x) {
      setMessage(x instanceof Error ? x.message : 'Check amounts.');
    }
  }
  return (
    <div className="planning">
      <div className="planning-cards">
        <Metric label="Current investment value" n={total} />
        <Metric label="Total contributed" n={contributed} />
        <Metric label="Gain / loss" n={total - contributed} />
        <Metric
          label="Monthly plan"
          n={investments.reduce((n, i) => n + i.monthlyContribution, 0)}
        />
      </div>
      <section className="panel planning-insights">
        <h2>Add investment product</h2>
        <p>
          Opening values are snapshots. They do not move bank cash. Liquid investments remain
          separate from safe-to-spend cash.
        </p>
        <form className="planning-budget-form" onSubmit={create}>
          <label>
            Name
            <input name="name" required maxLength={100} />
          </label>
          <label>
            Type
            <select name="investmentKind">
              <option>SIP</option>
              <option>GOLD</option>
              <option>FIXED_DEPOSIT</option>
              <option>PPF</option>
              <option>NPS</option>
              <option>OTHER</option>
            </select>
          </label>
          <label>
            Total contributed (INR)
            <input name="contributed" inputMode="decimal" required />
          </label>
          <label>
            Current value (INR)
            <input name="currentValue" inputMode="decimal" required />
          </label>
          <label>
            Monthly contribution (INR)
            <input name="monthlyContribution" inputMode="decimal" defaultValue="0" required />
          </label>
          <label>
            Next contribution
            <input name="nextContribution" type="date" />
          </label>
          <label>
            Maturity / end date
            <input name="maturityDate" type="date" />
          </label>
          <label>
            <input name="liquid" type="checkbox" /> Mark as liquid (still excluded from spending
            cash)
          </label>
          <label>
            Private notes
            <textarea name="notes" maxLength={500} />
          </label>
          <button className="button primary" disabled={busy}>
            Save investment
          </button>
        </form>
      </section>
      {investments.map((i) => (
        <section className="panel planning-insights" key={i.id}>
          <h2>{i.name}</h2>
          <p>
            {i.kind.replaceAll('_', ' ')} · Value {INR(i.currentValue)} · Contributed{' '}
            {INR(i.contributed)} · Gain/loss {INR(i.currentValue - i.contributed)}
          </p>
          <p>
            Monthly {INR(i.monthlyContribution)} · Next{' '}
            {i.nextContribution ? dateLabel(i.nextContribution) : 'not scheduled'} · Maturity{' '}
            {i.maturityDate ? dateLabel(i.maturityDate) : 'not set'} ·{' '}
            {i.liquid ? 'Liquid' : 'Not immediately liquid'}
          </p>
          <button className="text-button" onClick={() => setSelected(i.id)}>
            Record contribution, withdrawal or valuation →
          </button>
          {selected === i.id && (
            <form className="planning-budget-form" onSubmit={event}>
              <label>
                Event
                <select name="eventKind">
                  <option value="CONTRIBUTION">Contribution</option>
                  <option value="WITHDRAWAL">Withdrawal</option>
                  <option value="VALUATION">Valuation update</option>
                </select>
              </label>
              <label>
                Amount / new value (INR)
                <input name="amount" required inputMode="decimal" />
              </label>
              <label>
                Account (ignored for valuation)
                <select name="accountId">
                  <option value="">Choose account</option>
                  {data.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {INR(a.balance)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Date
                <input name="date" type="date" max={today()} defaultValue={today()} required />
              </label>
              <label>
                Notes
                <textarea name="notes" maxLength={500} />
              </label>
              <button className="button primary" disabled={busy}>
                Record event
              </button>
            </form>
          )}
        </section>
      ))}
      {message && <p role="status">{message}</p>}
    </div>
  );
}

function Goals({ data, demo }: { data: Data; demo: boolean }) {
  const { save, busy, message, setMessage } = useSave(demo);
  const [edit, setEdit] = useState<GoalData | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await save({
        kind: 'goal',
        id: edit?.id,
        name: value(f, 'name'),
        goalKind: value(f, 'goalKind'),
        targetDate: value(f, 'targetDate'),
        familyContribution: amount(f, 'familyContribution'),
        personalCash: amount(f, 'personalCash'),
        engagement: amount(f, 'engagement'),
        travel: amount(f, 'travel'),
        shopping: amount(f, 'shopping'),
        emergencyBuffer: amount(f, 'emergencyBuffer'),
        otherAmount: amount(f, 'otherAmount'),
        alreadySaved: amount(f, 'alreadySaved'),
        confirmedMoney: amount(f, 'confirmedMoney'),
        expectedMoney: amount(f, 'expectedMoney'),
        notes: value(f, 'notes'),
      });
      setEdit(null);
    } catch (x) {
      setMessage(x instanceof Error ? x.message : 'Check amounts.');
    }
  }
  const fields = [
    ['familyContribution', 'Family contribution'],
    ['personalCash', 'Personal cash required'],
    ['engagement', 'Engagement'],
    ['travel', 'Travel'],
    ['shopping', 'Shopping'],
    ['emergencyBuffer', 'Emergency buffer'],
    ['otherAmount', 'Other expenses'],
    ['alreadySaved', 'Already saved'],
    ['confirmedMoney', 'Other confirmed money'],
    ['expectedMoney', 'Expected money'],
  ];
  return (
    <div className="planning">
      <section className="panel planning-insights">
        <h2>{edit ? 'Update goal' : 'Add marriage or other goal'}</h2>
        <p>
          Expected money is shown separately and never reduces the confirmed shortfall.
          Already-saved values must refer to money you have truly earmarked.
        </p>
        <form key={edit?.id ?? 'new'} className="planning-budget-form" onSubmit={submit}>
          <label>
            Goal name
            <input name="name" required defaultValue={edit?.name} />
          </label>
          <label>
            Goal type
            <select name="goalKind" defaultValue={edit?.kind ?? 'MARRIAGE'}>
              <option value="MARRIAGE">Marriage</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label>
            Target date
            <input
              name="targetDate"
              type="date"
              required
              defaultValue={edit?.targetDate?.slice(0, 10)}
            />
          </label>
          {fields.map(([k, l]) => (
            <label key={k}>
              {l} (INR)
              <input
                name={k}
                inputMode="decimal"
                defaultValue={edit ? String(Number(edit[k as keyof GoalData]) / 100) : '0'}
                required
              />
            </label>
          ))}
          <label>
            Private notes
            <textarea name="notes" maxLength={500} defaultValue={edit?.notes ?? ''} />
          </label>
          <button className="button primary" disabled={busy}>
            {edit ? 'Save goal' : 'Create goal'}
          </button>
        </form>
        {message && <p role="status">{message}</p>}
      </section>
      {(data.goals ?? []).map((g) => {
        const s = goalSummary(g, today());
        return (
          <section className="panel planning-insights" key={g.id}>
            <h2>{g.name}</h2>
            <p>
              {dateLabel(g.targetDate)} · Total required {INR(s.total)} · Confirmed{' '}
              {INR(s.confirmed)} · Expected separately {INR(s.expected)}
            </p>
            <p>
              Confirmed shortfall {INR(s.shortfall)} · {s.monthsRemaining} month(s) · Required
              monthly saving {INR(s.requiredMonthly)} · Shortfall if expected money arrives{' '}
              {INR(s.expectedShortfall)}
            </p>
            <p>
              First options: reduce optional spending or goal budget, delay optional purchases,
              redirect matured savings, or increase income. A loan is only a comparison scenario.
            </p>
            <button className="text-button" onClick={() => setEdit(g)}>
              Edit goal →
            </button>
          </section>
        );
      })}
    </div>
  );
}

function WhatIf({ data }: { data: Data }) {
  const [result, setResult] = useState<ReturnType<typeof simulatePlan> | null>(null);
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setResult(
      simulatePlan(
        data,
        {
          purchase: amount(f, 'purchase'),
          extraDebt: amount(f, 'extraDebt'),
          pauseInvestmentMonths: Number(value(f, 'pauseMonths') || 0),
          receivable: amount(f, 'receivable'),
          receiveExpected: f.get('receiveExpected') === 'on',
          salaryDelayDays: Number(value(f, 'salaryDelay') || 0),
        },
        today(),
      ),
    );
  }
  return (
    <div className="planning">
      <section className="panel planning-insights">
        <h2>Compare a scenario without changing records</h2>
        <form className="planning-budget-form" onSubmit={submit}>
          <label>
            Optional purchase (INR)
            <input name="purchase" inputMode="decimal" defaultValue="0" />
          </label>
          <label>
            Extra debt repayment (INR)
            <input name="extraDebt" inputMode="decimal" defaultValue="0" />
          </label>
          <label>
            Pause investment for months
            <input name="pauseMonths" type="number" min="0" max="60" defaultValue="0" />
          </label>
          <label>
            Expected receivable (INR)
            <input name="receivable" inputMode="decimal" defaultValue="0" />
          </label>
          <label>
            <input name="receiveExpected" type="checkbox" /> Assume receivable arrives
          </label>
          <label>
            Salary delay days
            <input name="salaryDelay" type="number" min="0" max="90" defaultValue="0" />
          </label>
          <button className="button primary">Run what-if</button>
        </form>
      </section>
      {result && (
        <div className="planning-cards">
          <Metric label="Cash before" n={result.cash} />
          <Metric label="Cash after scenario" n={result.cashAfter} />
          <Metric label="Debt before" n={result.debt} />
          <Metric label="Debt after" n={result.debtAfter} />
        </div>
      )}
      {result && (
        <section className="panel planning-insights">
          <h2>Scenario impact</h2>
          <p>
            Paused contributions release {INR(result.paused)} in this simplified scenario. Included
            receipts: {INR(result.receipt)}.
          </p>
          <p>
            {result.salaryDelayed
              ? 'Salary delay selected: review every obligation due during the delay; this preview does not invent a future salary balance.'
              : 'No salary delay selected.'}
          </p>
          <p>This is a comparison only. It does not post transactions or recommend a loan.</p>
        </section>
      )}
    </div>
  );
}
function Metric({ label, n }: { label: string; n: number }) {
  return (
    <div className="panel planning-summary">
      <span>{label}</span>
      <strong>{INR(n)}</strong>
    </div>
  );
}
