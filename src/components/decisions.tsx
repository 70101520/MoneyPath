'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { calculate, dateLabel, INR, localDay, today, type Data } from '@/lib/finance';
import {
  debtForecast,
  historyReports,
  paymentPriority,
  planningNotifications,
  salaryAllocation,
  simulatePurchase,
  type DebtAssumption,
  type DebtStrategy,
  type PurchaseInput,
} from '@/lib/decision';
import { requestId } from '@/lib/request-id';

const reserveFields = [
  ['essentialReserve', 'Remaining essential living'],
  ['emergencyReserve', 'Emergency reserve'],
  ['goalReserve', 'Goal reserve'],
  ['extraDebtReserve', 'Extra debt repayment reserve'],
] as const;
function paise(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value))
    throw new Error('Enter INR with at most two decimal places.');
  const [whole, fraction = ''] = value.split('.');
  const n = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(n) || n > 1_000_000_000)
    throw new Error('Amount must be at most ₹1 crore.');
  return n;
}
function useSave(demo: boolean) {
  const router = useRouter(),
    pending = useRef<{ body: string; id: string } | null>(null);
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  async function save(command: unknown) {
    if (demo) {
      setMessage('Sample data is read-only. Sign in to save your plan.');
      return;
    }
    const body = JSON.stringify(command);
    if (pending.current?.body !== body) pending.current = { body, id: requestId() };
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': pending.current.id },
        body,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Unable to save');
      pending.current = null;
      setMessage('Plan saved.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save. Retry to confirm.');
    } finally {
      setBusy(false);
    }
  }
  return { save, message, setMessage, busy };
}
function Metric({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="panel planning-summary">
      <span>{label}</span>
      <strong>{value === null ? 'Information Required' : INR(value)}</strong>
    </div>
  );
}
function Details({ title, lines }: { title: string; lines: string[] }) {
  return (
    <section className="panel planning-insights">
      <h2>{title}</h2>
      {lines.map((s, i) => (
        <p key={i}>{s}</p>
      ))}
    </section>
  );
}
function Chart({
  rows,
  field,
  label,
}: {
  rows: Record<string, unknown>[];
  field: string;
  label: string;
}) {
  return (
    <div className="panel planning-insights">
      <h2>{label}</h2>
      <div
        style={{ height: 240, minWidth: 0 }}
        role="img"
        aria-label={label + '. Exact values are listed in the table below.'}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows}>
            <XAxis dataKey="month" />
            <YAxis width={65} tickFormatter={(n) => `₹${Math.round(n / 100)}`} />
            <Tooltip formatter={(n) => INR(Number(n))} />
            <Line
              type="monotone"
              dataKey={field}
              stroke="#236857"
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function Decisions({
  data,
  section,
  demo,
  navigate,
  pay,
}: {
  data: Data;
  section: string;
  demo: boolean;
  navigate: (s: string) => void;
  pay: (id: string, kind: string, amount: number) => void;
}) {
  if (section === 'salary-plan') return <SalaryPlan data={data} demo={demo} />;
  if (section === 'purchase') return <Purchase data={data} />;
  if (section === 'debt-plan') return <DebtPlanner data={data} demo={demo} />;
  if (section === 'reports') return <Reports data={data} />;
  if (section === 'notifications') {
    const alerts = planningNotifications(data);
    return (
      <div className="planning">
        <Details
          title="Your current reminders"
          lines={[
            'Rules are evaluated when you open the app. These are in-app reminders; background email and push delivery belong to Phase 4.',
          ]}
        />
        {alerts.length ? (
          alerts.map((a) => (
            <section key={a.id} className="panel planning-insights">
              <h2>{a.title}</h2>
              <p>{a.detail}</p>
              <button className="text-button" onClick={() => navigate(a.section)}>
                Review →
              </button>
            </section>
          ))
        ) : (
          <Details
            title="No current alerts"
            lines={['No reminder rule is triggered by your recorded data.']}
          />
        )}
      </div>
    );
  }
  const p = paymentPriority(data);
  return (
    <div className="planning">
      <Details
        title="What should I pay next?"
        lines={[
          'Overdue and near-due bills come first, with essential needs, insurance continuity and recorded card interest used to break priorities.',
          'Each payable amount preserves all other recorded reservations through salary, including food, emergency money and long-cycle funding. Review the updated list after each payment; these amounts are not a batch payment instruction.',
          `Salary horizon: ${p.horizon ? dateLabel(p.horizon) : 'Information Required'}. EMI entries are reserves until the installment is posted.`,
        ]}
      />
      <div className="planning-cards">
        <Metric label="Spendable cash" value={p.cash} />
        <Metric label="Safe to spend after all reserves" value={p.safe.available} />
        <Metric label="Funding shortfall" value={p.safe.shortfall} />
      </div>
      {p.ranked.length === 0 && (
        <Details
          title="No recorded payments due"
          lines={['Add your cards and commitments to build your payment plan.']}
        />
      )}
      {p.ranked.map((o) => (
        <section className="panel planning-insights" key={o.id}>
          <h2>
            {o.action} · {o.name}
          </h2>
          <p>
            {INR(o.amount)} due {dateLabel(o.date)}
          </p>
          <p>{o.reasons.join(' · ')}</p>
          {o.target && (
            <PenaltyEditor
              id={o.id.split(':')[0]}
              name={o.name}
              target={o.target}
              value={o.lateFee}
              demo={demo}
            />
          )}
          <p>
            Cash available for this payment while protecting other reserves:{' '}
            {o.payable === null ? 'Information Required' : INR(o.payable)}.
          </p>
          {o.canRecord && o.action !== 'Reserve now' && o.payable !== null && o.payable > 0 && (
            <button className="button primary" onClick={() => pay(o.id, o.kind, o.payable!)}>
              Record payment for {o.name}
            </button>
          )}
          {o.action === 'Reserve now' && (
            <button
              className="text-button"
              onClick={() => navigate(o.kind === 'EMI reserve' ? 'emi' : 'commitments')}
            >
              Review reserve
            </button>
          )}
        </section>
      ))}
    </div>
  );
}

function PenaltyEditor({
  id,
  name,
  target,
  value,
  demo,
}: {
  id: string;
  name: string;
  target: 'CARD' | 'COMMITMENT';
  value: number | null;
  demo: boolean;
}) {
  const [fee, setFee] = useState(value === null ? '' : String(value / 100));
  const { save, message, setMessage, busy } = useSave(demo);
  return (
    <details>
      <summary>Set potential late fee</summary>
      <form
        className="planning-budget-form"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            void save({
              kind: 'priorityCost',
              id,
              target,
              lateFee: fee === '' ? null : paise(fee),
            });
          } catch (e) {
            setMessage((e as Error).message);
          }
        }}
      >
        <label>
          Potential late fee for {name} (INR)
          <input value={fee} inputMode="decimal" onChange={(e) => setFee(e.target.value)} />
        </label>
        <p>
          Blank means unknown; zero means no fee. Enter an amount from your agreement. If a fee is
          actually charged, record the expense separately.
        </p>
        <button className="button primary" disabled={busy}>
          Save potential fee
        </button>
        {message && <p role="status">{message}</p>}
      </form>
    </details>
  );
}

function SalaryPlan({ data, demo }: { data: Data; demo: boolean }) {
  const salaries = data.incomes.filter((i) => i.source === 'Salary' && i.status === 'RECEIVED');
  const [incomeId, setIncomeId] = useState(salaries[0]?.id ?? '');
  const [fields, setFields] = useState(
    Object.fromEntries(
      reserveFields.map(([key]) => [
        key,
        data.settings[key] === null ? '' : String(data.settings[key]! / 100),
      ]),
    ),
  );
  const { save, message, setMessage, busy } = useSave(demo);
  let problem = '',
    reserves = { essentialReserve: 0, emergencyReserve: 0, goalReserve: 0, extraDebtReserve: 0 };
  try {
    for (const [key] of reserveFields) reserves[key] = paise(fields[key]);
  } catch (e) {
    problem = (e as Error).message;
  }
  const result = salaryAllocation(data, problem ? data.settings : reserves);
  const salary = salaries.find((i) => i.id === incomeId);
  return (
    <div className="planning">
      <Details
        title="This month's money plan"
        lines={[
          'Received salary is already included in your bank balance. Accepting this plan changes reservations only; it never credits salary a second time.',
          'Mandatory payments and long-cycle reserves are calculated from your commitments. Edit those records to change their amounts. The four editable reserves replace existing settings; do not also earmark money held in excluded accounts.',
          'Essential living is the remaining amount needed until salary. Review it after spending. Category budgets remain spending limits and are not deducted again.',
        ]}
      />
      <form
        className="panel planning-budget-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (problem) {
            setMessage(problem);
            return;
          }
          void save({ kind: 'salaryPlan', incomeId, revision: data.revision ?? '', ...reserves });
        }}
      >
        <label>
          Received salary
          <select value={incomeId} onChange={(e) => setIncomeId(e.target.value)} required>
            <option value="">Choose received salary</option>
            {salaries.map((i) => (
              <option value={i.id} key={i.id}>
                {dateLabel(i.date)} · {INR(i.amount)}
              </option>
            ))}
          </select>
        </label>
        {!salary && (
          <p>Information Required: record received salary in Income before accepting a plan.</p>
        )}
        {reserveFields.map(([key, label]) => (
          <label key={key}>
            {label} (INR)
            <input
              inputMode="decimal"
              value={fields[key]}
              required
              onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
            />
          </label>
        ))}
        <button
          className="button primary"
          disabled={
            busy || !salary || !!problem || result.safe.raw === null || !!result.safe.shortfall
          }
        >
          {busy ? 'Saving…' : 'Accept money plan'}
        </button>
        {problem && <p>{problem}</p>}
        {message && <p role="status">{message}</p>}
      </form>
      <div className="planning-cards">
        <Metric label="Selected salary received" value={salary?.amount ?? null} />
        <Metric label="Current spendable cash (includes salary)" value={result.cash} />
        <Metric label="Mandatory reservations" value={result.mandatory} />
        <Metric label="Proposed safe to spend" value={problem ? null : result.safe.available} />
        <Metric label="Proposed shortfall" value={problem ? null : result.safe.shortfall} />
      </div>
      <Details
        title="Mandatory allocation breakdown"
        lines={[
          ...result.groups.map((g) => `${g.category}: ${INR(g.amount)}`),
          `Card statements: ${INR(result.cardReserve)}`,
          `Unposted EMI reserves: ${INR(result.emiReserve)}`,
        ]}
      />
      <Details
        title="Accepted plans"
        lines={
          (data.salaryPlans ?? []).length
            ? data.salaryPlans!.map(
                (p) =>
                  `${dateLabel(localDay(p.acceptedAt))} · Cash ${INR(p.cashAtAcceptance)} · Mandatory ${INR(p.mandatoryAtAcceptance)} · Living ${INR(p.essentialReserve)} · Emergency ${INR(p.emergencyReserve)} · Goals ${INR(p.goalReserve)} · Extra debt ${INR(p.extraDebtReserve)}`,
              )
            : [
                'No accepted plan yet. Reaccepting a salary plan updates its current version; the audit retains each acceptance.',
              ]
        }
      />
    </div>
  );
}

function Purchase({ data }: { data: Data }) {
  const [item, setItem] = useState(''),
    [price, setPrice] = useState(''),
    [method, setMethod] = useState<'CASH' | 'CARD'>('CASH');
  const [essentiality, setEssentiality] = useState<PurchaseInput['essentiality']>('WANT');
  const [category, setCategory] = useState('Other');
  const [accountId, setAccountId] = useState(data.accounts.find((a) => a.spendable)?.id ?? ''),
    [cardId, setCardId] = useState(data.cards[0]?.id ?? '');
  const [result, setResult] = useState<ReturnType<typeof simulatePurchase> | null>(null),
    [error, setError] = useState('');
  const clear = () => {
    setResult(null);
    setError('');
  };
  return (
    <div className="planning">
      <form
        className="panel planning-budget-form"
        onSubmit={(e) => {
          e.preventDefault();
          setError('');
          try {
            setResult(
              simulatePurchase(data, {
                item,
                price: paise(price),
                method,
                essentiality,
                category,
                accountId,
                cardId,
              }),
            );
          } catch (e) {
            setResult(null);
            setError((e as Error).message);
          }
        }}
      >
        <h2>Can I buy this?</h2>
        <p>This is a preview. It never records a purchase or changes your balances.</p>
        <label>
          Item
          <input
            value={item}
            maxLength={100}
            required
            onChange={(e) => {
              setItem(e.target.value);
              clear();
            }}
          />
        </label>
        <label>
          Purchase price (INR)
          <input
            value={price}
            inputMode="decimal"
            required
            onChange={(e) => {
              setPrice(e.target.value);
              clear();
            }}
          />
        </label>
        <label>
          Purchase category
          <input
            value={category}
            maxLength={100}
            required
            list="purchase-categories"
            onChange={(e) => {
              setCategory(e.target.value);
              clear();
            }}
          />
        </label>
        <datalist id="purchase-categories">
          {[
            ...new Set([
              'Other',
              ...(data.budgets ?? []).map((b) => b.category),
              ...data.expenses.map((e) => e.category),
            ]),
          ].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </datalist>
        <label>
          Purchase payment method
          <select
            value={method}
            onChange={(e) => {
              setMethod(e.target.value as 'CASH' | 'CARD');
              clear();
            }}
          >
            <option value="CASH">Bank / cash / UPI / debit</option>
            <option value="CARD">Credit card</option>
          </select>
        </label>
        {method === 'CASH' ? (
          <label>
            Funding account
            <select
              value={accountId}
              required
              onChange={(e) => {
                setAccountId(e.target.value);
                clear();
              }}
            >
              <option value="">Choose account</option>
              {data.accounts
                .filter((a) => a.spendable)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </label>
        ) : (
          <label>
            Purchase card
            <select
              value={cardId}
              required
              onChange={(e) => {
                setCardId(e.target.value);
                clear();
              }}
            >
              <option value="">Choose card</option>
              {data.cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Purchase essentiality
          <select
            value={essentiality}
            onChange={(e) => {
              setEssentiality(e.target.value as PurchaseInput['essentiality']);
              clear();
            }}
          >
            {['MUST HAVE', 'IMPORTANT/FLEXIBLE', 'WANT'].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <button className="button primary">Simulate purchase</button>
        {error && <p role="alert">{error}</p>}
      </form>
      {result && (
        <>
          <Details title={result.label} lines={result.reasons} />
          <div className="planning-cards">
            <Metric label="Cash after purchase" value={result.cashAfter} />
            <Metric label="Total card debt after purchase" value={result.debtAfter} />
            <Metric
              label="Safe to spend after purchase / repayment reserve"
              value={result.after?.safe.available ?? null}
            />
            <Metric label="Shortfall after purchase" value={result.after?.safe.shortfall ?? null} />
          </div>
          <Details
            title="Risk impact"
            lines={[
              `Current score: ${result.before.risk.score ?? 'Information Required'}. Simulated reserve/balance score: ${result.after?.risk.score ?? 'Information Required'}. The purchase assessment also checks funding capacity and essentiality separately.`,
              ...(result.utilization === null
                ? []
                : [
                    `Selected card utilization after purchase: ${(result.utilization * 100).toFixed(1)}%.`,
                  ]),
            ]}
          />
        </>
      )}
    </div>
  );
}

function DebtPlanner({ data, demo }: { data: Data; demo: boolean }) {
  const saved = data.debtPlan;
  const [monthly, setMonthly] = useState(saved ? String(saved.monthlyPayment / 100) : '');
  const [strategy, setStrategy] = useState<DebtStrategy>(saved?.strategy ?? 'AVALANCHE');
  const cards = data.cards.filter(
    (c) => c.outstanding + c.emis.reduce((n, e) => n + e.principalRemaining, 0) > 0,
  );
  const [fields, setFields] = useState(
    Object.fromEntries(
      cards.map((c, i) => {
        const a = saved?.assumptions.find((a) => a.cardId === c.id);
        return [
          c.id,
          {
            rate: a
              ? String(a.annualRateBps / 100)
              : c.emis.some((e) => e.principalRemaining > 0)
                ? ''
                : String(c.interestBps / 100),
            minimum: a
              ? String(a.minimum / 100)
              : String(Math.max(0, c.minimumDue - c.statementPaid) / 100),
            rank: String(a?.rank ?? i + 1),
          },
        ];
      }),
    ),
  );
  const [confirmed, setConfirmed] = useState(false);
  const { save, message, busy } = useSave(demo);
  const s = calculate(data);
  let problem = '',
    assumptions: DebtAssumption[] = [],
    payment = 0;
  try {
    payment = paise(monthly);
    assumptions = cards.map((c) => ({
      cardId: c.id,
      annualRateBps: paise(fields[c.id]?.rate ?? ''),
      minimum: paise(fields[c.id]?.minimum ?? ''),
      rank: Number(fields[c.id]?.rank),
    }));
  } catch (e) {
    problem = (e as Error).message;
  }
  const result = problem ? null : debtForecast(data, payment, strategy, assumptions);
  const avalanche = problem ? null : debtForecast(data, payment, 'AVALANCHE', assumptions),
    snowball = problem ? null : debtForecast(data, payment, 'SNOWBALL', assumptions);
  const capacity =
    s.safe.raw === null
      ? null
      : Math.max(
          0,
          s.safe.raw + s.cardReserve + s.emiReserve + (data.settings.extraDebtReserve ?? 0),
        );
  const update = (id: string, key: 'rate' | 'minimum' | 'rank', value: string) => {
    setFields({ ...fields, [id]: { ...fields[id], [key]: value } });
    setConfirmed(false);
  };
  return (
    <div className="planning">
      <Details
        title="Get out of debt"
        lines={[
          'Scenario only: no new borrowing or fees, fixed monthly payment, monthly interest at the annual rate you enter divided by 12, rounded up to paise. First modeled payment is next month. Pay currently due bills using Payment priorities.',
          'Each modeled balance includes posted debt and unbilled EMI principal. For cards with EMI, enter an explicit blended forecast APR. This simplified model does not reproduce issuer installment schedules, taxes, grace periods or foreclosure charges.',
          'The minimum you enter is a fixed monthly floor until a balance is settled, not an automatically declining issuer minimum. Confirm it includes the EMI cash you intend to allocate. Future income is not guaranteed.',
        ]}
      />
      <div className="planning-cards">
        <Metric label="Total card debt including EMI" value={s.debt} />
        <Metric label="New card debt this month" value={s.newSpending} />
        <Metric label="Debt paid this month" value={s.debtPaid} />
        <Metric label="Net debt reduction this month" value={s.netDebtReduction} />
        <Metric label="Cash available for debt after other reserves today" value={capacity} />
      </div>
      {!cards.length ? (
        <Details title="No recorded card debt" lines={['There is no card balance to forecast.']} />
      ) : (
        <form
          className="panel planning-budget-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!problem && confirmed)
              void save({ kind: 'debtPlan', monthlyPayment: payment, strategy, assumptions });
          }}
        >
          <label>
            Monthly debt payment (INR)
            <input
              inputMode="decimal"
              value={monthly}
              required
              onChange={(e) => {
                setMonthly(e.target.value);
                setConfirmed(false);
              }}
            />
          </label>
          <label>
            Payoff strategy
            <select value={strategy} onChange={(e) => setStrategy(e.target.value as DebtStrategy)}>
              <option value="AVALANCHE">Debt avalanche · highest APR first</option>
              <option value="SNOWBALL">Debt snowball · smallest balance first</option>
              <option value="CUSTOM">Custom priority · lowest rank first</option>
            </select>
          </label>
          {cards.map((c) => (
            <fieldset className="planning-assumption" key={c.id}>
              <legend>{c.name}</legend>
              <label>
                Forecast APR for {c.name} (%)
                <input
                  inputMode="decimal"
                  value={fields[c.id]?.rate ?? ''}
                  onChange={(e) => update(c.id, 'rate', e.target.value)}
                  required
                />
              </label>
              <label>
                Monthly minimum for {c.name} (INR)
                <input
                  inputMode="decimal"
                  value={fields[c.id]?.minimum ?? ''}
                  onChange={(e) => update(c.id, 'minimum', e.target.value)}
                  required
                />
              </label>
              <label>
                Priority for {c.name}
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={fields[c.id]?.rank ?? ''}
                  onChange={(e) => update(c.id, 'rank', e.target.value)}
                  required
                />
              </label>
            </fieldset>
          ))}
          <label className="planning-confirm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I confirm these forecast assumptions, including any EMI balance.
          </label>
          <button
            className="button primary"
            disabled={busy || !confirmed || !!problem || !!result?.missing.length}
          >
            Save debt scenario
          </button>
          {message && <p role="status">{message}</p>}
        </form>
      )}
      {cards.length > 0 && (
        <>
          {problem ? (
            <Details
              title="Information Required"
              lines={[
                'Enter the monthly payment and all forecast assumptions to calculate a scenario.',
                problem,
              ]}
            />
          ) : (
            result && (
              <>
                <Details
                  title="Scenario outcome"
                  lines={[
                    ...(result.reason
                      ? [result.reason]
                      : [
                          `Projected debt-free month: ${result.debtFree} (${result.months} months).`,
                          `Modeled interest: ${INR(result.interest!)}.`,
                        ]),
                    ...result.missing,
                    capacity === null
                      ? 'Information Required: complete settings to check present affordability.'
                      : payment > capacity
                        ? `This monthly payment exceeds today’s protected debt capacity by ${INR(payment - capacity)}. Saving a scenario does not mean it is affordable.`
                        : 'The modeled payment fits today’s protected cash capacity. Recheck when income or bills change.',
                    'Confirm assumptions before saving. Forecasts are estimates, not payment instructions.',
                  ]}
                />
                {avalanche?.interest !== null &&
                  avalanche?.interest !== undefined &&
                  snowball?.interest !== null &&
                  snowball?.interest !== undefined && (
                    <Details
                      title="Compare strategies at the same payment"
                      lines={[
                        `Avalanche interest: ${INR(avalanche.interest)}; snowball interest: ${INR(snowball.interest)}.`,
                        `Modeled interest saved by avalanche versus snowball: ${INR(snowball.interest - avalanche.interest)}.`,
                      ]}
                    />
                  )}
                {result.schedule.length > 0 && (
                  <>
                    <Chart rows={result.schedule} field="balance" label="Projected card debt" />
                    <div className="panel planning-table-wrap">
                      <table className="planning-table">
                        <caption>Monthly payoff schedule</caption>
                        <thead>
                          <tr>
                            <th>Month</th>
                            <th>Target for extra payment</th>
                            <th>Payment</th>
                            <th>Interest</th>
                            <th>Remaining</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.schedule.map((r) => (
                            <tr key={r.month}>
                              <td>{r.month}</td>
                              <td>{r.target}</td>
                              <td>{INR(r.payment)}</td>
                              <td>{INR(r.interest)}</td>
                              <td>{INR(r.balance)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
                <Details
                  title="Projected card payoff dates"
                  lines={
                    result.payoff.length
                      ? result.payoff.map((p) => `${p.card}: ${p.month}`)
                      : ['No card is paid off within the calculated schedule yet.']
                  }
                />
              </>
            )
          )}
        </>
      )}
    </div>
  );
}

function Reports({ data }: { data: Data }) {
  const [month, setMonth] = useState(today().slice(0, 7));
  const rows = historyReports(data, month),
    s = calculate(data);
  const points = rows.map((r) => ({
    month: r.month,
    debt: r.metrics?.debt ?? null,
    spending: r.cardSpending,
  }));
  return (
    <div className="planning">
      <label className="planning-month">
        Report ending month
        <input
          type="month"
          min="2000-01"
          max="2100-12"
          value={month}
          onChange={(e) => {
            if (/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(e.target.value)) setMonth(e.target.value);
          }}
        />
      </label>
      <Details
        title="Recorded history, not reconstructed balances"
        lines={[
          'Twelve calendar months ending in the selected month. The current month is incomplete. Transaction totals include only recorded entries; zero does not establish complete records.',
          'Account cash flow sums received income minus account-funded expenses and card repayments. Internal investment transfers are excluded from net account flow and shown separately. Card purchases count as expenses, not account cash outflow.',
          'Debt and tracked net worth use the last saved snapshot in each month, not an assumed month-end balance. Earlier snapshots without balance metrics show Information Required. Tracked net worth is recorded accounts minus card and EMI debt; untracked assets, personal loans and receivables are excluded.',
        ]}
      />
      <Chart rows={points} field="debt" label="Recorded card debt snapshots" />
      <Chart rows={points} field="spending" label="New card debt by month" />
      <div className="panel planning-table-wrap">
        <table className="planning-table">
          <caption>Monthly cash flow, savings and budget report</caption>
          <thead>
            <tr>
              {[
                'Month',
                'Received',
                'Expenses',
                'Account inflow',
                'Account outflow',
                'Net account flow',
                'Card spending',
                'Debt repaid',
                'Net debt reduction',
                'Investment transfers',
                'Budget overruns',
                'Debt snapshot',
                'Tracked net worth',
                'Risk',
                'Snapshot date',
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month}>
                <th scope="row">{r.month}</th>
                {[
                  r.income,
                  r.total,
                  r.cashIn,
                  r.cashOut,
                  r.netCashFlow,
                  r.cardSpending,
                  r.debtPayments,
                  r.netDebtReduction,
                  r.investmentTransfers,
                ].map((v, i) => (
                  <td key={i}>{INR(v)}</td>
                ))}
                <td>{r.budgetOverruns}</td>
                <td>{r.metrics ? INR(r.metrics.debt) : 'Information Required'}</td>
                <td>{r.metrics ? INR(r.metrics.netWorth) : 'Information Required'}</td>
                <td>
                  {r.score === null ? 'Information Required' : `${r.score}/100 (${r.version})`}
                </td>
                <td>{r.snapshotDate ? dateLabel(localDay(r.snapshotDate)) : 'Not recorded'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Details
        title={`Current risk · ${s.risk.score ?? 'Information Required'}/100 · ${s.riskVersion}`}
        lines={[
          'Scores of different rule versions are not directly comparable. Missing budgets and historical balances are not inferred; current rules evaluate recorded information only.',
          ...s.risk.rules.map((r) => `${r.points >= 0 ? '+' : ''}${r.points}: ${r.reason}`),
        ]}
      />
      <div className="panel planning-insights">
        <h2>Risk history</h2>
        {(data.risks ?? []).length ? (
          data.risks!.slice(0, 100).map((r) => (
            <details key={r.id}>
              <summary>
                {dateLabel(localDay(r.createdAt))} · {r.score ?? 'Information Required'} ·{' '}
                {r.version}
              </summary>
              {r.rules.map((rule) => (
                <p key={rule.id}>
                  {rule.points > 0 ? '+' : ''}
                  {rule.points} · {rule.reason}
                </p>
              ))}
            </details>
          ))
        ) : (
          <p>
            No saved risk history yet. Each successful record or plan save stores a versioned
            result.
          </p>
        )}
        <p>Showing the most recent 100 risk events; the monthly table uses all recorded history.</p>
      </div>
    </div>
  );
}
