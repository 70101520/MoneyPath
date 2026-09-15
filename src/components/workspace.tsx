'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  ArrowDownLeft,
  Landmark,
  Repeat2,
  ReceiptText,
  CreditCard,
  Layers3,
  ArrowLeftRight,
  CalendarDays,
  Settings2,
  Plus,
  ArrowUpRight,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Bell,
  Menu,
  X,
  LogOut,
  CircleHelp,
  Check,
  TrendingDown,
  Wallet,
  Download,
  AlertTriangle,
  MessageCircle,
  Sparkles,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import {
  emiOccurrences,
  calculate,
  INR,
  dateLabel,
  monthlyReserve,
  daysBetween,
  day,
  today,
  type Data,
} from '@/lib/finance';
import { RecordForm } from './record-form';
import { Planning } from './planning';
import { Decisions } from './decisions';
import { PersonalBalances } from './personal';
import { FuturePlanning } from './future';
import { FinanceAssistant } from './assistant';
import { Integrations } from './integrations';
import { planningNotifications } from '@/lib/decision';
import { financialActionPlan } from '@/lib/guidance';
const navigation = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'income', label: 'Income', icon: ArrowDownLeft },
  { id: 'accounts', label: 'Bank accounts', icon: Landmark },
  { id: 'commitments', label: 'Commitments', icon: Repeat2 },
  { id: 'expenses', label: 'Expenses', icon: ReceiptText },
  { id: 'cards', label: 'Credit cards', icon: CreditCard },
  { id: 'emi', label: 'Card EMIs', icon: Layers3 },
  { id: 'payments', label: 'Payments', icon: ArrowLeftRight },
  { id: 'calendar', label: 'Financial calendar', icon: CalendarDays },
  { id: 'budgets', label: 'Budgets', icon: Wallet },
  { id: 'spending', label: 'Spending analysis', icon: ReceiptText },
  { id: 'salary-plan', label: 'Salary plan', icon: Wallet },
  { id: 'priority', label: 'Payment priorities', icon: ArrowLeftRight },
  { id: 'purchase', label: 'Can I buy this?', icon: ShieldCheck },
  { id: 'debt-plan', label: 'Get out of debt', icon: TrendingDown },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'reports', label: 'Reports', icon: ReceiptText },
  { id: 'receivables', label: 'Money to receive', icon: ArrowDownLeft },
  { id: 'payables', label: 'Money I owe', icon: ArrowLeftRight },
  { id: 'investments', label: 'Investments', icon: TrendingDown },
  { id: 'goals', label: 'Marriage & goals', icon: ShieldCheck },
  { id: 'what-if', label: 'What-if simulator', icon: CircleHelp },
  { id: 'assistant', label: 'Finance assistant', icon: CircleHelp },
  { id: 'integrations', label: 'Mobile & integrations', icon: Settings2 },
];
const colors = ['#337569', '#91ada1', '#d7b787', '#8295aa', '#b5bdc5', '#e0d5c1'];
export function Workspace({
  data,
  section,
  demo = false,
}: {
  data: Data;
  section: string;
  demo?: boolean;
}) {
  const router = useRouter();
  const [demoSection, setDemoSection] = useState(section),
    [mobile, setMobile] = useState(false),
    [form, setForm] = useState<{ kind: string; initial?: Record<string, unknown> } | null>(null),
    [toast, setToast] = useState(''),
    [search, setSearch] = useState(''),
    [assistantOpen, setAssistantOpen] = useState(false);
  const active = demo ? demoSection : section;
  const s = calculate(data);
  const guidance = financialActionPlan(data);
  const open = (kind: string, initial?: Record<string, unknown>) => setForm({ kind, initial });
  const go = (id: string) => {
    if (demo) setDemoSection(id);
    else router.push('/' + id);
    setMobile(false);
    setSearch('');
  };
  const name = navigation.find((n) => n.id === active)?.label ?? 'Settings';
  const addKind: Record<string, string> = {
    income: 'income',
    accounts: 'account',
    commitments: 'commitment',
    expenses: 'expense',
    cards: 'card',
    emi: 'emi',
    payments: 'payment',
    settings: 'settings',
  };
  const upcoming = s.obligations.filter((o) => o.amount > 0).slice(0, 4);
  async function logout() {
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    location.assign('/login');
  }
  const save = () => {
    setForm(null);
    router.refresh();
    setToast('Saved. Your balances and plan have been updated.');
    setTimeout(() => setToast(''), 5000);
  };
  const payment = (id: string, kind: string, amount: number) =>
    kind === 'Private liability'
      ? go('payables')
      : open('payment', {
          type: kind === 'Credit card' ? 'STATEMENT' : 'COMMITMENT',
          ...(kind === 'Credit card'
            ? { cardId: id.split(':')[0] }
            : { commitmentId: id.split(':')[0] }),
          amount,
        });
  return (
    <div className="app-shell">
      <aside className={'sidebar ' + (mobile ? 'visible' : '')}>
        <Link href={demo ? '/demo' : '/dashboard'} className="brand">
          <span className="brand-mark">
            m<span>↗</span>
          </span>{' '}
          MoneyPath<span className="brand-dot">.</span>
        </Link>
        <button
          className="mobile-close icon-button"
          onClick={() => setMobile(false)}
          aria-label="Close navigation"
        >
          <X />
        </button>
        <div className="workspace-tag">
          <span className="workspace-avatar">B</span>
          <div>
            Personal workspace<small>One step closer, every day</small>
          </div>
          <ChevronRight size={14} />
        </div>
        <p className="nav-label">YOUR MONEY</p>
        <nav>
          {navigation.map((n) => (
            <button
              key={n.id}
              aria-label={n.label}
              className={active === n.id ? 'nav-item active' : 'nav-item'}
              onClick={() => go(n.id)}
            >
              <n.icon size={19} />
              {n.label}
              {n.id === 'cards' && data.cards.length > 0 && (
                <span className="nav-count">{data.cards.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="mini-leaf">↗</span>
            <strong>Progress over perfection.</strong>
            <p>Every thoughtful money decision moves you forward.</p>
          </div>
          <button
            className={'nav-item ' + (active === 'settings' ? 'active' : '')}
            onClick={() => go('settings')}
          >
            <Settings2 size={19} />
            Settings
          </button>
          <div className="profile">
            <span className="avatar">{data.settings.name.slice(0, 1)}</span>
            <div>
              <strong>{data.settings.name}</strong>
              <small>{demo ? 'Sample workspace' : 'Personal account'}</small>
            </div>
            <button
              className="icon-button"
              onClick={demo ? () => location.assign('/login') : logout}
              aria-label={demo ? 'Sign in' : 'Sign out'}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobile(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <span>My workspace</span>
            <ChevronRight size={13} />
            <strong>{name}</strong>
          </div>
          <div className="topbar-right">
            <span className="private-badge">
              <span />
              Private & secure
            </span>
            <button
              className="icon-button notification-button"
              onClick={() => go('notifications')}
              aria-label="Upcoming payment notifications"
            >
              <Bell size={19} />
              {planningNotifications(data).length > 0 && <i />}
            </button>
            <span className="avatar small">{data.settings.name.slice(0, 1)}</span>
          </div>
        </header>
        {demo && (
          <div className="demo-banner">
            <span>Sample workspace · Illustrative balances, not your financial data</span>
            <Link href="/login">
              Set up your account <ArrowRight size={14} />
            </Link>
          </div>
        )}
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {active === 'dashboard' ? 'YOUR FINANCIAL PICTURE' : 'YOUR MONEY, ORGANIZED'}
              </div>
              <h1>
                {active === 'dashboard'
                  ? `Let’s make your money go further${data.settings.name ? ', ' + data.settings.name.split(' ')[0] : ''}.`
                  : active === 'calendar'
                    ? 'A little planning. Fewer surprises.'
                    : name}
              </h1>
              <p>
                {active === 'dashboard'
                  ? 'Here’s where you stand. And a clear path for what comes next.'
                  : descriptions[active]}
              </p>
            </div>
            <div className="heading-actions">
              {active === 'dashboard' ? (
                <>
                  <span className="date-pill">
                    <CalendarDays size={15} />
                    {new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(
                      day(s.asOf),
                    )}
                  </span>
                  <button className="button primary" onClick={() => open('expense')}>
                    <Plus size={17} />
                    Add expense
                  </button>
                </>
              ) : (
                addKind[active] && (
                  <button
                    className="button primary"
                    onClick={() =>
                      open(
                        addKind[active],
                        active === 'settings' ? { ...data.settings } : undefined,
                      )
                    }
                  >
                    <Plus size={17} />
                    {active === 'settings'
                      ? 'Edit settings'
                      : 'Add ' +
                        (active === 'accounts'
                          ? 'account'
                          : active === 'cards'
                            ? 'card'
                            : active === 'emi'
                              ? 'EMI'
                              : active === 'commitments'
                                ? 'commitment'
                                : active === 'payments'
                                  ? 'payment'
                                  : active === 'expenses'
                                    ? 'expense'
                                    : 'income')}
                  </button>
                )
              )}
            </div>
          </div>
          {toast && (
            <div className="toast" role="status">
              <Check size={16} />
              {toast}
            </div>
          )}
          {s.required.length > 0 && (
            <div className="information">
              <CircleHelp size={20} />
              <div>
                <strong>Information Required</strong>
                <p>Complete {s.required.join(', ')} to calculate safe to spend and risk.</p>
              </div>
              <button className="text-button" onClick={() => go('settings')}>
                Review settings →
              </button>
            </div>
          )}
          <div className="page-content-transition" key={active}>
            {active === 'integrations' ? (
              <Integrations demo={demo} data={data} />
            ) : active === 'assistant' ? (
              <FinanceAssistant data={data} demo={demo} />
            ) : ['investments', 'goals', 'what-if'].includes(active) ? (
              <FuturePlanning data={data} section={active} demo={demo} />
            ) : active === 'receivables' || active === 'payables' ? (
              <PersonalBalances
                key={active}
                data={data}
                direction={active === 'receivables' ? 'RECEIVABLE' : 'PAYABLE'}
                demo={demo}
              />
            ) : [
                'salary-plan',
                'priority',
                'purchase',
                'debt-plan',
                'notifications',
                'reports',
              ].includes(active) ? (
              <Decisions
                key={active}
                data={data}
                section={active}
                demo={demo}
                navigate={go}
                pay={payment}
              />
            ) : active === 'budgets' || active === 'spending' ? (
              <Planning data={data} section={active} demo={demo} />
            ) : active === 'dashboard' ? (
              <>
                <div className="overview-grid">
                  <section className="safe-card">
                    <div className="safe-top">
                      <span>
                        <ShieldCheck size={17} /> YOUR SAFE-TO-SPEND BALANCE
                      </span>
                      <span className="live-label">After reservations</span>
                    </div>
                    <div className="safe-amount">
                      {s.safe.available === null ? (
                        <span className="unknown-amount">Information Required</span>
                      ) : (
                        INR(s.safe.available)
                      )}
                    </div>
                    <p>
                      {s.safe.shortfall
                        ? `${INR(s.safe.shortfall)} more is needed to cover your plan.`
                        : 'Your money to use, with your commitments protected.'}
                    </p>
                    <div className="safe-breakdown">
                      <div>
                        <span>Available cash</span>
                        <strong>{INR(s.cash)}</strong>
                      </div>
                      <span className="math-symbol">−</span>
                      <div>
                        <span>Bills & reservations</span>
                        <strong>{s.safe.raw === null ? '—' : INR(s.cash - s.safe.raw)}</strong>
                      </div>
                      <span className="safe-icon">
                        <Wallet size={26} />
                      </span>
                    </div>
                    <div className="safe-footer">
                      <span>
                        <span className="status-dot" />
                        {s.horizon
                          ? 'Planned through ' + dateLabel(s.horizon)
                          : 'Add your salary schedule'}
                      </span>
                      <button onClick={() => go('settings')}>
                        View your plan <ArrowUpRight size={15} />
                      </button>
                    </div>
                  </section>
                  <section className="panel risk-card">
                    <div className="panel-heading">
                      <h2>Financial health</h2>
                      <span
                        className={
                          'badge ' +
                          (s.risk.score !== null && s.risk.score > 50 ? 'amber' : 'green')
                        }
                      >
                        {s.risk.label}
                      </span>
                    </div>
                    <div className="risk-score">
                      <strong>{s.risk.score ?? '—'}</strong>
                      <span>
                        / 100<span>Risk score · lower is better</span>
                      </span>
                      <div className="risk-glyph">
                        <ShieldCheck size={30} />
                      </div>
                    </div>
                    <div className="risk-track">
                      <span />
                      <span />
                      <span />
                      <span />
                      <i style={{ left: `${s.risk.score ?? 0}%` }} />
                    </div>
                    <div className="risk-scale">
                      <span>Low</span>
                      <span>Critical</span>
                    </div>
                    <div className="risk-reasons">
                      {s.risk.rules.length ? (
                        s.risk.rules.slice(0, 2).map((r) => (
                          <p key={r.id}>
                            <span className="reason-dot" />
                            {r.reason}
                          </p>
                        ))
                      ) : (
                        <p>
                          {s.risk.score === null
                            ? 'Complete your inputs to see your risk.'
                            : 'No basic risk rules are currently triggered.'}
                        </p>
                      )}
                    </div>
                    <button className="text-button" onClick={() => go('settings')}>
                      Understand your score <ArrowRight size={14} />
                    </button>
                  </section>
                </div>
                <div className="stats-grid">
                  <Stat
                    label="Income this month"
                    value={INR(s.income)}
                    icon={<ArrowDownLeft size={18} />}
                    note={
                      data.settings.monthlyIncome === null
                        ? 'Expected income: Information Required'
                        : 'Expected ' + INR(data.settings.monthlyIncome)
                    }
                    tone="green"
                  />
                  <Stat
                    label="Spent this month"
                    value={INR(s.expenseTotal)}
                    icon={<ReceiptText size={18} />}
                    note="Purchases only · no debt repayments"
                  />
                  <Stat
                    label="Total credit card debt"
                    value={INR(s.debt)}
                    icon={<CreditCard size={18} />}
                    note={`${data.cards.length} cards · including unbilled EMI`}
                    tone="amber"
                  />
                  <Stat
                    label="Savings & investments"
                    value={INR(s.nonSpendable + s.investmentValue)}
                    icon={<Landmark size={18} />}
                    note="Non-spendable accounts plus tracked products"
                    tone="green"
                  />
                  {!!data.personalEntries?.length && (
                    <>
                      <Stat
                        label="Private liabilities"
                        value={INR(s.privateDebt)}
                        icon={<ArrowLeftRight size={18} />}
                        note="Separate from card debt"
                        tone="amber"
                      />
                      <Stat
                        label="Money expected back"
                        value={INR(s.expectedReceivables)}
                        icon={<ArrowDownLeft size={18} />}
                        note="Excluded from available cash"
                      />
                    </>
                  )}
                </div>
                <section className="panel planning-insights">
                  <div className="panel-heading">
                    <div>
                      <h2>{guidance.headline}</h2>
                      <p>Updates automatically from the records you enter.</p>
                    </div>
                    <button className="text-button" onClick={() => go('assistant')}>
                      Ask MoneyPath <ArrowRight size={14} />
                    </button>
                  </div>
                  {guidance.actions.slice(0, 4).map((action) => (
                    <button
                      className="action-row"
                      key={`${action.level}-${action.title}`}
                      onClick={() => go(action.section)}
                    >
                      <span className={`badge ${action.level === 'NOW' ? 'danger' : 'neutral'}`}>
                        {action.level}
                      </span>
                      <span>
                        <strong>{action.title}</strong>
                        <small>{action.detail}</small>
                      </span>
                      <ChevronRight size={17} />
                    </button>
                  ))}
                </section>
                <div className="detail-grid">
                  <section className="panel payments-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>What’s coming up</h2>
                        <p>Ahead of the bills. In control of your money.</p>
                      </div>
                      <button className="text-button" onClick={() => go('calendar')}>
                        View calendar <ArrowUpRight size={15} />
                      </button>
                    </div>
                    {upcoming.length ? (
                      <div className="upcoming-list">
                        {upcoming.map((o, i) => (
                          <div className="upcoming-row" key={o.id}>
                            <span className={'obligation-icon color-' + i}>
                              {o.kind === 'Credit card' ? (
                                <CreditCard size={20} />
                              ) : o.kind.includes('Insurance') || o.kind === 'LIC' ? (
                                <ShieldCheck size={20} />
                              ) : (
                                <Repeat2 size={20} />
                              )}
                            </span>
                            <div className="obligation-title">
                              <strong>{o.name}</strong>
                              <span>
                                {o.kind} <i>·</i> {dateLabel(o.date)}
                              </span>
                            </div>
                            <div className="obligation-amount">
                              <strong>{INR(o.amount)}</strong>
                              <span className={o.days <= 3 ? 'due-soon' : ''}>
                                {o.days < 0
                                  ? `${-o.days} days overdue`
                                  : o.days === 0
                                    ? 'Due today'
                                    : `Due in ${o.days} days`}
                              </span>
                            </div>
                            <button
                              className="row-arrow"
                              aria-label={'View ' + o.name}
                              onClick={() =>
                                o.kind === 'EMI reserve'
                                  ? go('emi')
                                  : payment(o.id, o.kind, o.amount)
                              }
                            >
                              <ArrowUpRight size={17} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Empty text="Add commitments and card statements to see upcoming payments." />
                    )}
                    <div className="panel-foot">
                      <span>
                        <span className="status-dot amber-dot" /> Next 7 days
                      </span>
                      <strong>
                        {INR(
                          s.obligations
                            .filter((o) => o.days <= 7)
                            .reduce((a, o) => a + o.amount, 0),
                        )}{' '}
                        <small>required cash</small>
                      </strong>
                    </div>
                  </section>
                  <section className="panel spending-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Where your money goes</h2>
                        <p>This month’s spending, at a glance.</p>
                      </div>
                      <button
                        className="icon-button"
                        aria-label="View expenses"
                        onClick={() => go('expenses')}
                      >
                        <ArrowUpRight size={18} />
                      </button>
                    </div>
                    {s.categories.length ? (
                      <>
                        <div className="donut-wrap">
                          <ResponsiveContainer width="100%" height={196}>
                            <PieChart>
                              <Pie
                                isAnimationActive={false}
                                data={s.categories}
                                dataKey="value"
                                innerRadius={66}
                                outerRadius={88}
                                paddingAngle={4}
                                stroke="none"
                                cornerRadius={4}
                              >
                                {s.categories.map((c, i) => (
                                  <Cell key={c.name} fill={colors[i % colors.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(v) => INR(Number(v))} />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="donut-center">
                            <span>Total spent</span>
                            <strong>{INR(s.expenseTotal)}</strong>
                          </div>
                        </div>
                        <div className="chart-legend">
                          {s.categories.slice(0, 4).map((c, i) => (
                            <div key={c.name}>
                              <span>
                                <i style={{ background: colors[i % colors.length] }} />
                                {c.name}
                              </span>
                              <strong>{INR(c.value)}</strong>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <Empty text="Your spending picture starts with your first expense." />
                    )}
                  </section>
                </div>
                <div className="bottom-grid">
                  <section className="panel debt-panel">
                    <div className="debt-icon">
                      <TrendingDown size={24} />
                    </div>
                    <div>
                      <h2>Make your debt move in the right direction.</h2>
                      <p>
                        {INR(s.debtPaid)} paid − {INR(s.newSpending)} new debt this month
                      </p>
                    </div>
                    <div className="debt-result">
                      <strong className={s.netDebtReduction >= 0 ? 'text-green' : 'text-amber'}>
                        {INR(s.netDebtReduction)}
                      </strong>
                      <span>net debt reduction</span>
                    </div>
                  </section>
                  <section className="tip-panel">
                    <span className="mini-leaf">✳</span>
                    <div>
                      <strong>A small pause makes a difference.</strong>
                      <p>Check your safe-to-spend balance before your next purchase.</p>
                    </div>
                  </section>
                </div>
                <div className="dashboard-meta">
                  <span>
                    <ShieldCheck size={13} /> Calculated from your records. Expected income and
                    credit limits are excluded.
                  </span>
                  <span>All amounts in INR</span>
                </div>
              </>
            ) : active === 'calendar' ? (
              <FinancialCalendar data={data} />
            ) : active === 'settings' ? (
              <div className="settings-grid">
                <section className="panel padded">
                  <h2>Your money plan</h2>
                  <p className="muted">
                    Reservations apply to cash inside spendable accounts. Update remaining
                    essentials as the month progresses.
                  </p>
                  <dl className="breakdown-list">
                    {[
                      ['Available cash', s.cash],
                      ['Upcoming bills & sinking funds', s.mandatory],
                      ['Essential living', data.settings.essentialReserve],
                      ['Emergency earmark', data.settings.emergencyReserve],
                      ['Goal earmark', data.settings.goalReserve],
                      ['Extra debt payment', data.settings.extraDebtReserve],
                      ['Safe to spend', s.safe.available],
                    ].map(([label, value]) => (
                      <div key={String(label)}>
                        <dt>{label}</dt>
                        <dd>{value === null ? 'Information Required' : INR(Number(value))}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="muted">
                    Salary normally arrives on day {data.settings.salaryDay ?? '—'}. Next salary:{' '}
                    {s.horizon ? dateLabel(s.horizon) : 'Information Required'}.
                  </p>
                </section>
                <section className="panel padded">
                  <h2>Why this risk score?</h2>
                  <p className="muted">
                    Basic rules v1 · {s.risk.score ?? '—'}/100 · {s.risk.label}
                  </p>
                  {s.risk.rules.map((r) => (
                    <div className="rule" key={r.id}>
                      <span>+{r.points}</span>
                      {r.reason}
                    </div>
                  ))}
                  <p className="muted">
                    0–30 Low · 31–50 Moderate · 51–70 High · 71–100 Critical. This Phase 1 score
                    covers recorded card debt, cash and commitments; loans and longer-term trends
                    are not yet tracked.
                  </p>
                  <h3>Data & privacy</h3>
                  <p className="muted">
                    Notes and card identifiers are encrypted. Export your transaction records for
                    your own review.
                  </p>
                  {demo ? (
                    <span className="badge neutral">Exports available after account setup</span>
                  ) : (
                    <div className="heading-actions">
                      <a href="/api/export" className="button">
                        <Download size={16} />
                        Export transactions CSV
                      </a>
                      <a href="/api/export/excel" className="button">
                        <Download size={16} />
                        Export Excel workbook
                      </a>
                    </div>
                  )}
                </section>
              </div>
            ) : (
              <>
                {active === 'cards' && (
                  <div className="stats-grid three">
                    <Stat
                      label="Old bills to pay"
                      value={INR(s.oldBill)}
                      note="Remaining statement balances"
                    />
                    <Stat
                      label="New / unbilled spending"
                      value={INR(
                        data.cards.reduce(
                          (a, c) => a + c.outstanding - (c.statementAmount - c.statementPaid),
                          0,
                        ),
                      )}
                      note="Posted outstanding minus old bills"
                    />
                    <Stat
                      label="Unbilled EMI liability"
                      value={INR(
                        data.cards
                          .flatMap((c) => c.emis)
                          .reduce((a, e) => a + e.principalRemaining, 0),
                      )}
                      note="Not included in posted outstanding"
                    />
                  </div>
                )}
                {active === 'cards' ? (
                  <div className="cards-grid">
                    {data.cards.map((c, i) => {
                      const emi = c.emis.reduce((a, e) => a + e.principalRemaining, 0);
                      const difference =
                        c.availableLimit === null
                          ? null
                          : c.creditLimit - c.availableLimit - c.outstanding - emi;
                      return (
                        <section className="panel card-detail" key={c.id}>
                          <div className={'physical-card card-theme-' + (i % 3)}>
                            <div>
                              <strong>{c.bank}</strong>
                              <span className="card-chip">▥</span>
                            </div>
                            <h2>{c.name}</h2>
                            <div>
                              <span>•••• {c.lastFour ?? '••••'}</span>
                              <span>{c.status}</span>
                            </div>
                          </div>
                          <div className="card-body">
                            <dl className="breakdown-list">
                              <div>
                                <dt>Old bill to pay</dt>
                                <dd>{INR(c.statementAmount - c.statementPaid)}</dd>
                              </div>
                              <div>
                                <dt>New / unbilled</dt>
                                <dd>{INR(c.outstanding - c.statementAmount + c.statementPaid)}</dd>
                              </div>
                              <div>
                                <dt>Unbilled EMI principal</dt>
                                <dd>{INR(emi)}</dd>
                              </div>
                              <div>
                                <dt>Total current debt</dt>
                                <dd>{INR(c.outstanding + emi)}</dd>
                              </div>
                            </dl>
                            <p className="muted">
                              Due {dateLabel(c.dueDate)} · Minimum{' '}
                              {INR(Math.max(0, c.minimumDue - c.statementPaid))}
                            </p>
                            <details>
                              <summary>Statement & limit reconciliation</summary>
                              {(c.carriedBalance ?? 0) > 0 && (
                                <p className="muted">
                                  Includes {INR(c.carriedBalance!)} carried from an earlier bill,
                                  due {dateLabel(c.carriedDueDate!)}. Statement payments clear this
                                  carried balance first.
                                </p>
                              )}
                              <p className="muted">
                                Statement {dateLabel(c.statementDate)}: {INR(c.statementAmount)} ·
                                Paid {INR(c.statementPaid)}. APR {c.interestBps / 100}%.
                              </p>
                              <p className="muted">
                                Limit {INR(c.creditLimit)} − reported available{' '}
                                {c.availableLimit === null
                                  ? 'Information Required'
                                  : INR(c.availableLimit)}{' '}
                                − posted debt {INR(c.outstanding)} − blocked EMI {INR(emi)} ={' '}
                                {difference === null ? 'Information Required' : INR(difference)}.
                              </p>
                              <p className="muted">
                                {difference === 0
                                  ? 'Reconciled.'
                                  : difference === null
                                    ? 'Enter the latest available limit with your next statement.'
                                    : 'Difference requires checking pending holds, fees or the issuer’s EMI structure.'}{' '}
                                Credit availability is never cash.
                              </p>
                            </details>
                            {!!c.statements?.length && (
                              <details>
                                <summary>Previous statements</summary>
                                {c.statements.map((statement) => (
                                  <p className="muted" key={statement.id}>
                                    {dateLabel(statement.statementDate)} · Bill{' '}
                                    {INR(statement.amount)} · Paid before rollover{' '}
                                    {INR(statement.paid)} · Carried{' '}
                                    {INR(statement.amount - statement.paid)}
                                  </p>
                                ))}
                              </details>
                            )}
                            <div className="card-actions">
                              <button
                                className="button primary"
                                onClick={() =>
                                  open('payment', {
                                    type: 'STATEMENT',
                                    cardId: c.id,
                                    amount: c.statementAmount - c.statementPaid,
                                  })
                                }
                              >
                                Record payment
                              </button>
                              <button
                                className="text-button"
                                onClick={() => open('statement', { id: c.id, status: c.status })}
                              >
                                Next statement →
                              </button>
                            </div>
                          </div>
                        </section>
                      );
                    })}
                    {!data.cards.length && (
                      <Empty text="Add your first card with its latest statement and posted outstanding." />
                    )}
                  </div>
                ) : (
                  <section className="panel records-panel">
                    <div className="panel-heading">
                      <h2>
                        {name}{' '}
                        <span className="badge neutral">
                          {active === 'emi'
                            ? data.cards.flatMap((c) => c.emis).length
                            : active === 'accounts'
                              ? data.accounts.length
                              : active === 'commitments'
                                ? data.commitments.length
                                : active === 'income'
                                  ? data.incomes.length
                                  : active === 'expenses'
                                    ? data.expenses.length
                                    : data.payments.length}{' '}
                          records
                        </span>
                      </h2>
                      <input
                        className="search-input"
                        placeholder="Filter records…"
                        aria-label="Filter records"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <Records data={data} section={active} search={search} open={open} />
                  </section>
                )}
              </>
            )}
          </div>
        </main>
      </div>
      {active !== 'assistant' && (
        <>
          <button
            className="assistant-fab"
            onClick={() => setAssistantOpen(true)}
            aria-label="Open Ask MoneyPath"
            aria-expanded={assistantOpen}
          >
            <Sparkles size={18} />
            <span>Ask MoneyPath</span>
            <MessageCircle size={19} />
          </button>
          {assistantOpen && (
            <div className="assistant-drawer-layer" role="presentation">
              <button
                className="assistant-drawer-backdrop"
                aria-label="Close Ask MoneyPath"
                onClick={() => setAssistantOpen(false)}
              />
              <aside className="assistant-drawer" aria-label="Ask MoneyPath chat">
                <div className="assistant-drawer-heading">
                  <div>
                    <small>YOUR FINANCIAL COMPANION</small>
                    <h2>Ask MoneyPath</h2>
                  </div>
                  <button
                    className="icon-button"
                    onClick={() => setAssistantOpen(false)}
                    aria-label="Close assistant"
                  >
                    <X size={20} />
                  </button>
                </div>
                <FinanceAssistant data={data} demo={demo} compact />
              </aside>
            </div>
          )}
        </>
      )}
      {form && (
        <RecordForm
          key={form.kind + String(form.initial?.id ?? '')}
          kind={form.kind}
          initial={form.initial}
          data={data}
          demo={demo}
          onClose={() => setForm(null)}
          onSaved={save}
        />
      )}
    </div>
  );
}
const descriptions: Record<string, string> = {
  investments:
    'Track contributions, valuations, liquidity and maturity without treating assets as spending cash.',
  goals: 'Plan marriage and other goals using confirmed and expected money separately.',
  'what-if': 'Compare choices without changing your financial records.',
  assistant:
    'Plain-language answers grounded in your recorded data and deterministic calculations.',
  integrations: 'Connect read-only mobile clients and review external delivery options.',
  receivables: 'Track expected receipts without counting them as spendable cash.',
  payables: 'Track private liabilities, repayment dates and cash reservations.',
  'salary-plan': 'Give your received salary a clear purpose.',
  priority: 'Protect essentials while deciding what to pay next.',
  purchase: 'Check the effect before you spend.',
  'debt-plan': 'Compare a path out of card debt using your assumptions.',
  notifications: 'Upcoming bills, spending limits and reserve reminders.',
  reports: 'Understand recorded cash flow, debt progress and risk history.',
  budgets: 'Set monthly limits and see which categories need attention.',
  spending: 'Understand recorded purchases, repayments and month-to-month changes.',
  income: 'Track what has arrived and what you are expecting. Only received money adds to cash.',
  accounts: 'A clear separation between everyday cash and money set aside.',
  commitments: 'Keep every recurring payment covered, even the ones that only come once a year.',
  expenses: 'A simple record of purchases. Card repayments are kept separate.',
  cards: 'Old bills, new spending and EMI liabilities. Every balance in its place.',
  emi: 'Keep unbilled principal separate. Post each installment using its actual principal and interest.',
  payments: 'Record money paid toward a statement or commitment, without counting it twice.',
  calendar: 'Your income and commitments, together in one view.',
  settings: 'Make the plan fit your life. Every reservation is yours to adjust.',
};
function Stat({
  label,
  value,
  note,
  icon,
  tone = '',
}: {
  label: string;
  value: string;
  note: string;
  icon?: React.ReactNode;
  tone?: string;
}) {
  return (
    <section className="stat-card">
      <div>
        <span>{label}</span>
        {icon && <span className={'stat-icon ' + tone}>{icon}</span>}
      </div>
      <strong>{value}</strong>
      <p>{note}</p>
    </section>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <Wallet size={28} />
      <h3>A clear start.</h3>
      <p>{text}</p>
    </div>
  );
}
function Records({
  data,
  section,
  search,
  open,
}: {
  data: Data;
  section: string;
  search: string;
  open: (kind: string, initial?: Record<string, unknown>) => void;
}) {
  type Row = { id: string; cells: React.ReactNode[]; search: string };
  let headers: string[] = [];
  let rows: Row[] = [];
  if (section === 'accounts') {
    headers = ['Account', 'Type', 'Balance', 'Availability'];
    rows = data.accounts.map((a) => ({
      id: a.id,
      search: a.name,
      cells: [
        <strong key="n">{a.name}</strong>,
        a.kind,
        INR(a.balance),
        <span key="b" className={'badge ' + (a.spendable ? 'green' : 'neutral')}>
          {a.spendable ? 'Spendable cash' : 'Set aside'}
        </span>,
      ],
    }));
  }
  if (section === 'income') {
    headers = ['Source', 'Date', 'Amount', 'Status', ''];
    rows = data.incomes.map((i) => ({
      id: i.id,
      search: i.source + ' ' + i.notes,
      cells: [
        <div key="n">
          <strong>{i.source}</strong>
          <small>
            {i.notes}
            {i.recurring ? ' · Recurring' : ''}
          </small>
        </div>,
        dateLabel(i.date),
        INR(i.amount),
        <span key="s" className={'badge ' + (i.status === 'RECEIVED' ? 'green' : 'amber')}>
          {i.status}
        </span>,
        i.status === 'EXPECTED' ? (
          <button
            key="a"
            className="text-button"
            onClick={() => open('receiveIncome', { id: i.id })}
          >
            Mark received →
          </button>
        ) : null,
      ],
    }));
  }
  if (section === 'expenses') {
    headers = ['Description', 'Date', 'Category', 'Amount', 'Paid with', 'Essentiality'];
    rows = data.expenses.map((e) => ({
      id: e.id,
      search: e.category + ' ' + e.description,
      cells: [
        <strong key="n">{e.description ?? e.category}</strong>,
        dateLabel(e.date),
        e.category,
        INR(e.amount),
        e.method,
        <span key="s" className={'badge ' + (e.essentiality === 'WANT' ? 'amber' : 'neutral')}>
          {e.essentiality}
        </span>,
      ],
    }));
  }
  if (section === 'commitments') {
    headers = [
      'Commitment',
      'Frequency',
      'Next unpaid due',
      'Amount',
      'Monthly reserve',
      'Funded',
      '',
    ];
    rows = data.commitments.map((c) => ({
      id: c.id,
      search: c.name + ' ' + c.category,
      cells: [
        <div key="n">
          <strong>{c.name}</strong>
          <small>
            {c.category}
            {!c.active ? ' · Paused' : ''}
          </small>
        </div>,
        c.intervalMonths === 1 ? 'Monthly' : `Every ${c.intervalMonths} months`,
        dateLabel(c.dueDate),
        INR(c.amount),
        INR(monthlyReserve(c.amount, c.intervalMonths)),
        INR(c.funded),
        <div key="a" className="inline-actions">
          <button
            className="text-button"
            onClick={() =>
              open('payment', { type: 'COMMITMENT', commitmentId: c.id, amount: c.amount - c.paid })
            }
          >
            Pay
          </button>
          <button className="text-button" onClick={() => open('updateCommitment', { ...c })}>
            Edit
          </button>
        </div>,
      ],
    }));
  }
  if (section === 'emi') {
    headers = [
      'EMI / Card',
      'Principal remaining',
      'Monthly EMI',
      'Installments',
      'Next posting',
      '',
    ];
    rows = data.cards.flatMap((c) =>
      c.emis.map((e) => ({
        id: e.id,
        search: e.name + ' ' + c.name,
        cells: [
          <div key="n">
            <strong>{e.name}</strong>
            <small>{c.name}</small>
          </div>,
          INR(e.principalRemaining),
          INR(e.monthlyEmi),
          `${e.installmentsPaid} / ${e.totalInstallments} posted`,
          dateLabel(e.nextDate),
          e.principalRemaining > 0 ? (
            <div key="a" className="inline-actions">
              <button
                className="text-button"
                onClick={() =>
                  open('postEmi', {
                    id: e.id,
                    principal: e.nextPrincipal || undefined,
                    interest: e.nextInterest,
                  })
                }
              >
                Post installment →
              </button>
              <button
                className="text-button"
                onClick={() =>
                  open('emiSchedule', {
                    id: e.id,
                    nextPrincipal: e.nextPrincipal || undefined,
                    nextInterest: e.nextInterest,
                  })
                }
              >
                Update schedule
              </button>
            </div>
          ) : (
            <span key="b" className="badge green">
              Complete
            </span>
          ),
        ],
      })),
    );
  }
  if (section === 'payments') {
    headers = ['Payment to', 'Date', 'Amount', 'Allocation', 'Paid from'];
    rows = data.payments.map((p) => ({
      id: p.id,
      search: p.type + ' ' + p.notes,
      cells: [
        <div key="n">
          <strong>
            {data.cards.find((c) => c.id === p.cardId)?.name ??
              data.commitments.find((c) => c.id === p.commitmentId)?.name ??
              'Payment'}
          </strong>
          <small>{p.notes}</small>
        </div>,
        dateLabel(p.date),
        INR(p.amount),
        <span key="b" className="badge neutral">
          {p.type}
        </span>,
        data.accounts.find((a) => a.id === p.accountId)?.name,
      ],
    }));
  }
  rows = rows.filter((r) => r.search.toLowerCase().includes(search.toLowerCase()));
  return rows.length ? (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              {r.cells.map((c, i) => (
                <td key={i}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty
      text={
        search
          ? 'No records match your filter.'
          : 'Add a record to start building your financial picture.'
      }
    />
  );
}
function FinancialCalendar({ data }: { data: Data }) {
  const [offset, setOffset] = useState(0);
  const now = day(today());
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const end = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
  const s = calculate(data);
  const events: { date: string; name: string; amount: number | null; kind: string }[] = [];
  for (const c of data.commitments.filter((c) => c.active)) {
    let d = day(c.dueDate);
    for (let i = 0; i < 2400 && d <= end; i++) {
      if (d >= first)
        events.push({
          date: d.toISOString().slice(0, 10),
          name: c.name,
          amount: c.amount - (i === 0 ? c.paid : 0),
          kind: 'bill',
        });
      const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + c.intervalMonths, 1));
      next.setUTCDate(
        Math.min(
          c.anchorDay,
          new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate(),
        ),
      );
      d = next;
    }
  }
  data.cards.forEach((c) => {
    events.push(
      {
        date: c.statementDate.slice(0, 10),
        name: c.name + ' statement',
        amount: null,
        kind: 'statement',
      },
      {
        date: c.dueDate.slice(0, 10),
        name: c.name,
        amount: c.statementAmount - c.statementPaid - (c.carriedBalance ?? 0),
        kind: 'bill',
      },
    );
    if ((c.carriedBalance ?? 0) > 0 && c.carriedDueDate)
      events.push({
        date: c.carriedDueDate.slice(0, 10),
        name: c.name + ' · carried balance',
        amount: c.carriedBalance!,
        kind: 'bill',
      });
    c.emis
      .filter((e) => e.principalRemaining > 0)
      .forEach((e) =>
        emiOccurrences(e, end.toISOString().slice(0, 10)).forEach((o) =>
          events.push({ date: o.date, name: e.name, amount: o.amount, kind: 'bill' }),
        ),
      );
  });
  for (const entry of data.personalEntries ?? [])
    if (entry.dueDate && entry.amount > entry.settled)
      events.push({
        date: entry.dueDate.slice(0, 10),
        name: `${entry.reference}${entry.direction === 'RECEIVABLE' ? ' · expected receipt' : ' · repayment'}`,
        amount: entry.amount - entry.settled,
        kind: entry.direction === 'RECEIVABLE' ? 'income' : 'bill',
      });
  if (data.settings.salaryDay) {
    const d = new Date(first);
    d.setUTCDate(Math.min(data.settings.salaryDay, end.getUTCDate()));
    events.push({
      date: d.toISOString().slice(0, 10),
      name: 'Expected salary',
      amount: data.settings.monthlyIncome,
      kind: 'income',
    });
  }
  const monthEvents = events.filter(
    (e) => e.date >= first.toISOString().slice(0, 10) && e.date <= end.toISOString().slice(0, 10),
  );
  // Cash windows expand commitments independently of next salary horizon.
  const cashWindow = (n: number) => {
    const until = new Date(now);
    until.setUTCDate(until.getUTCDate() + n);
    let amount = 0;
    for (const c of data.commitments.filter((c) => c.active)) {
      let d = day(c.dueDate);
      for (let i = 0; i < 2400 && d <= until; i++) {
        amount += c.amount - (i === 0 ? c.paid : 0);
        const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + c.intervalMonths, 1));
        next.setUTCDate(
          Math.min(
            c.anchorDay,
            new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate(),
          ),
        );
        d = next;
      }
    }
    amount += s.obligations
      .filter((o) => ['Credit card', 'Private liability'].includes(o.kind) && o.days <= n)
      .reduce((a, o) => a + o.amount, 0);
    amount += data.cards
      .flatMap((c) => c.emis)
      .filter((e) => e.principalRemaining > 0)
      .flatMap((e) => emiOccurrences(e, until.toISOString().slice(0, 10)))
      .reduce((a, o) => a + o.amount, 0);
    return amount;
  };
  return (
    <>
      <div className="stats-grid three">
        {[7, 15, 30].map((n) => (
          <Stat
            key={n}
            label={`Next ${n} days required cash`}
            value={INR(cashWindow(n))}
            note="Includes overdue obligations and EMI reserves"
          />
        ))}
      </div>
      <section className="panel calendar-panel">
        <div className="panel-heading">
          <h2>
            {new Intl.DateTimeFormat('en-IN', {
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            }).format(first)}
          </h2>
          <div className="inline-actions">
            <button
              className="icon-button"
              aria-label="Previous month"
              onClick={() => setOffset(offset - 1)}
            >
              <ChevronLeft size={18} />
            </button>
            <button className="text-button" onClick={() => setOffset(0)}>
              Today
            </button>
            <button
              className="icon-button"
              aria-label="Next month"
              onClick={() => setOffset(offset + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <div className="calendar-grid">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div className="weekday" key={d}>
              {d}
            </div>
          ))}
          {Array.from({ length: first.getUTCDay() }, (_, i) => (
            <div className="calendar-day blank" key={'b' + i} />
          ))}
          {Array.from({ length: end.getUTCDate() }, (_, i) => {
            const d = new Date(first);
            d.setUTCDate(i + 1);
            const date = d.toISOString().slice(0, 10);
            return (
              <div className={'calendar-day ' + (date === today() ? 'is-today' : '')} key={date}>
                <span>{i + 1}</span>
                {monthEvents
                  .filter((e) => e.date === date)
                  .map((e, j) => (
                    <div key={j} className={'calendar-event ' + e.kind} title={e.name}>
                      <strong>{e.name}</strong>
                      <small>{e.amount === null ? 'Information Required' : INR(e.amount)}</small>
                    </div>
                  ))}
              </div>
            );
          })}
        </div>
        <div className="mobile-agenda">
          {monthEvents
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((e, i) => (
              <div className="upcoming-row" key={i}>
                <div>
                  <strong>{e.name}</strong>
                  <small>{dateLabel(e.date)}</small>
                </div>
                <strong>{e.amount === null ? '—' : INR(e.amount)}</strong>
              </div>
            ))}
        </div>
        <div className="panel-foot">
          <span>Salary is expected, not available cash.</span>
          <span>Card dates reflect the latest entered statement.</span>
        </div>
      </section>
    </>
  );
}
