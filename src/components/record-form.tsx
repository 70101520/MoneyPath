'use client';
import { useEffect, useRef, useState } from 'react';
import { X, ArrowRight } from 'lucide-react';
import { today, type Data } from '@/lib/finance';
import { requestId as newRequestId } from '@/lib/request-id';
type Field = {
  name: string;
  label: string;
  type?: 'money' | 'number' | 'date' | 'checkbox' | 'select' | 'text';
  options?: { value: string; label: string }[];
  required?: boolean;
  hint?: string;
  default?: string | number | boolean;
};
const opt = (values: string[]) => values.map((v) => ({ value: v, label: v }));
export function RecordForm({
  kind,
  data,
  initial,
  onClose,
  onSaved,
  demo,
}: {
  kind: string;
  data: Data;
  initial?: Record<string, unknown>;
  onClose: () => void;
  onSaved: () => void;
  demo?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const requestId = useRef(newRequestId());
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialogRef.current?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);
  const [method, setMethod] = useState(String(initial?.method ?? 'UPI'));
  const [paymentType, setPaymentType] = useState(String(initial?.type ?? 'STATEMENT'));
  const a = data.accounts.map((a) => ({ value: a.id, label: a.name })),
    c = data.cards.map((c) => ({ value: c.id, label: c.name })),
    commitments = data.commitments
      .filter((c) => c.active)
      .map((c) => ({ value: c.id, label: c.name }));
  const m = (name: string, label: string, hint?: string): Field => ({
    name,
    label,
    type: 'money',
    hint,
  });
  const d = (name = 'date', label = 'Date'): Field => ({
    name,
    label,
    type: 'date',
    default: today(),
  });
  const sel = (
    name: string,
    label: string,
    options: { value: string; label: string }[],
    required = true,
  ): Field => ({ name, label, type: 'select', options, required });
  const fields: Record<string, Field[]> = {
    account: [
      { name: 'name', label: 'Account name' },
      sel('type', 'Account type', opt(['BANK', 'CASH', 'SAVINGS', 'INVESTMENT'])),
      m(
        'balance',
        'Opening balance',
        'Enter the balance before transactions you will record here.',
      ),
      { name: 'spendable', label: 'Available for spending', type: 'checkbox', default: true },
    ],
    income: [
      m('amount', 'Amount'),
      d(),
      sel('source', 'Source', opt(['Salary', 'Bonus', 'Side Income', 'Other Income'])),
      sel('status', 'Status', opt(['RECEIVED', 'EXPECTED'])),
      sel('accountId', 'Received into', a, false),
      { name: 'recurring', label: 'Recurring income', type: 'checkbox' },
      { name: 'notes', label: 'Notes', required: false },
    ],
    receiveIncome: [sel('accountId', 'Receive into', a), d()],
    expense: [
      m('amount', 'Amount'),
      d(),
      sel(
        'category',
        'Category',
        opt([
          'Groceries',
          'Fuel',
          'Travel',
          'Mobile Recharge',
          'Medical',
          'Eating Out',
          'Shopping',
          'Family',
          'Education',
          'Wedding',
          'Utility',
          'Entertainment',
          'Other',
        ]),
      ),
      sel(
        'method',
        'Payment method',
        opt(['UPI', 'Cash', 'Debit Card', 'Credit Card', 'Bank Transfer']),
      ),
      method === 'Credit Card' ? sel('cardId', 'Credit card', c) : sel('accountId', 'Paid from', a),
      sel(
        'essentiality',
        'How necessary was it?',
        opt(['MUST HAVE', 'IMPORTANT/FLEXIBLE', 'WANT']),
      ),
      { name: 'description', label: 'Description', required: false },
    ],
    commitment: [
      { name: 'name', label: 'Commitment name' },
      sel(
        'category',
        'Category',
        opt([
          'Family Support',
          'LIC',
          'Term Insurance',
          'Tuition',
          'SIP',
          'Gold Saving Plan',
          'Mobile Recharge',
          'Household',
          'Subscription',
          'Other',
        ]),
      ),
      m('amount', 'Payment amount'),
      sel('intervalMonths', 'Frequency', [
        { value: '1', label: 'Monthly' },
        { value: '3', label: 'Quarterly' },
        { value: '6', label: 'Half-yearly' },
        { value: '12', label: 'Yearly' },
        { value: 'custom', label: 'Custom interval' },
      ]),
      {
        name: 'customInterval',
        label: 'Custom interval (months)',
        type: 'number',
        required: false,
        hint: 'Only used for Custom frequency.',
      },
      d('dueDate', 'Next unpaid due date'),
      m('funded', 'Already reserved', 'Earmarked cash inside your spendable bank accounts.'),
      { name: 'essential', label: 'Essential commitment', type: 'checkbox', default: true },
    ],
    updateCommitment: [
      { name: 'name', label: 'Commitment name' },
      m('amount', 'Payment amount'),
      m('funded', 'Already reserved'),
      { name: 'essential', label: 'Essential commitment', type: 'checkbox' },
      { name: 'active', label: 'Active recurring commitment', type: 'checkbox' },
    ],
    card: [
      { name: 'bank', label: 'Bank' },
      { name: 'name', label: 'Card nickname' },
      { name: 'lastFour', label: 'Last four digits only', required: false },
      m('creditLimit', 'Total credit limit'),
      {
        ...m(
          'availableLimit',
          'Reported available limit',
          'Optional. Used only for reconciliation.',
        ),
        required: false,
      },
      m('outstanding', 'Posted outstanding', 'Exclude unbilled EMI principal; include billed EMI.'),
      m('statementAmount', 'Statement amount'),
      m('statementPaid', 'Already paid against statement'),
      d('statementDate', 'Statement date'),
      d('dueDate', 'Payment due date'),
      m('minimumDue', 'Minimum due'),
      {
        name: 'interestBps',
        label: 'Annual interest rate (basis points)',
        type: 'number',
        hint: '4200 = 42% per year.',
      },
      sel('status', 'Card status', opt(['ACTIVE', 'FROZEN', 'CLOSED'])),
    ],
    statement: [
      m('statementAmount', 'New statement amount'),
      d('statementDate', 'Statement date'),
      d('dueDate', 'Payment due date'),
      m('minimumDue', 'Minimum due'),
      { ...m('availableLimit', 'Reported available limit'), required: false },
      sel('status', 'Status', opt(['ACTIVE', 'FROZEN', 'CLOSED'])),
    ],
    emi: [
      {
        name: 'newPurchase',
        label: 'New financed purchase (also record the purchase expense)',
        type: 'checkbox',
      },
      d('purchaseDate', 'Purchase date (for new financing)'),
      sel('cardId', 'Credit card', c),
      { name: 'name', label: 'EMI name' },
      m('originalAmount', 'Original principal'),
      m(
        'principalRemaining',
        'Unbilled principal remaining',
        'Must not also be included in posted card outstanding.',
      ),
      m('monthlyEmi', 'Monthly EMI'),
      m('nextPrincipal', 'Next installment principal'),
      m('nextInterest', 'Next installment interest'),
      { name: 'totalInstallments', label: 'Total installments', type: 'number' },
      { name: 'installmentsPaid', label: 'Installments already posted', type: 'number' },
      d('nextDate', 'Next installment date'),
    ],
    postEmi: [
      d(),
      m('principal', 'Principal on this installment'),
      m('interest', 'Interest on this installment'),
    ],
    emiSchedule: [
      m('nextPrincipal', 'Next installment principal'),
      m('nextInterest', 'Next installment interest'),
    ],
    payment: [
      sel('type', 'Payment allocation', opt(['STATEMENT', 'UNBILLED', 'COMMITMENT'])),
      paymentType === 'COMMITMENT'
        ? sel('commitmentId', 'Commitment', commitments)
        : sel('cardId', 'Credit card', c),
      sel('accountId', 'Pay from', a),
      m('amount', 'Payment amount'),
      d(),
      ...(paymentType === 'COMMITMENT'
        ? [sel('destinationAccountId', 'Investment destination (SIP / gold only)', a, false)]
        : []),
      { name: 'notes', label: 'Notes', required: false },
    ],
    settings: [
      { name: 'name', label: 'Your name' },
      { name: 'salaryDay', label: 'Salary day of month', type: 'number' },
      m('monthlyIncome', 'Expected monthly income'),
      m(
        'essentialReserve',
        'Remaining essential living reserve',
        'Cash needed for food, transport and other essentials until next salary.',
      ),
      m(
        'emergencyReserve',
        'Emergency cash earmark',
        'Only the portion inside spendable accounts.',
      ),
      m('goalReserve', 'Goal cash earmark', 'Only the portion inside spendable accounts.'),
      m(
        'extraDebtReserve',
        'Additional debt repayment reserve',
        'Extra payment above upcoming statement dues.',
      ),
    ],
  };
  const titles: Record<string, string> = {
    account: 'Add bank account',
    income: 'Add income',
    receiveIncome: 'Receive expected income',
    expense: 'Add an expense',
    commitment: 'Add commitment',
    updateCommitment: 'Edit commitment',
    card: 'Add credit card',
    statement: 'Enter next statement',
    emi: 'Add card EMI',
    postEmi: 'Post EMI installment',
    emiSchedule: 'Update next EMI components',
    payment: 'Record a payment',
    settings: 'Your money settings',
  };
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (demo) {
      setError('Sample data is read-only. Set up your account to save your own records.');
      return;
    }
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const body: Record<string, unknown> = { kind, ...(initial?.id ? { id: initial.id } : {}) };
    for (const field of fields[kind]) {
      const value = form.get(field.name);
      if (field.name === 'customInterval') continue;
      if (field.type === 'checkbox') body[field.name] = value === 'on';
      else if (field.name === 'intervalMonths')
        body[field.name] = value === 'custom' ? Number(form.get('customInterval')) : Number(value);
      else if (value === '') {
        if (field.name === 'availableLimit') body[field.name] = null;
      } else if (field.type === 'money') {
        const raw = String(value);
        if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
          setError('Enter rupees with at most two decimal places.');
          setBusy(false);
          return;
        }
        const [rupees, paise = ''] = raw.split('.');
        body[field.name] = Number(rupees) * 100 + Number(paise.padEnd(2, '0'));
      } else if (field.type === 'number') body[field.name] = Number(value);
      else body[field.name] = value;
    }
    try {
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestId.current },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) {
        requestId.current = newRequestId();
        throw new Error(result.error);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please retry.');
      setBusy(false);
    }
  }
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <dialog ref={dialogRef} className="modal" aria-labelledby="form-title" onCancel={onClose}>
        <header>
          <div>
            <span className="eyebrow">MONEYPATH · {demo ? 'SAMPLE PREVIEW' : 'YOUR RECORDS'}</span>
            <h2 id="form-title">{titles[kind]}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close form">
            <X />
          </button>
        </header>
        <form onSubmit={submit}>
          <div className="form-grid">
            {fields[kind]?.map((field) => {
              const value = initial?.[field.name] ?? field.default;
              return (
                <label
                  key={field.name}
                  className={field.type === 'checkbox' ? 'checkbox-label' : ''}
                >
                  {field.type !== 'checkbox' && field.label}
                  {field.type === 'select' ? (
                    <select
                      name={field.name}
                      required={field.required !== false}
                      defaultValue={String(
                        value ??
                          (field.required === false ? '' : (field.options?.[0]?.value ?? '')),
                      )}
                      onChange={(e) => {
                        if (field.name === 'method') setMethod(e.target.value);
                        if (field.name === 'type') setPaymentType(e.target.value);
                      }}
                    >
                      {field.required === false && <option value="">Select if applicable</option>}
                      {field.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'checkbox' ? (
                    <>
                      <input type="checkbox" name={field.name} defaultChecked={Boolean(value)} />
                      {field.label}
                    </>
                  ) : (
                    <input
                      autoFocus={field === fields[kind][0]}
                      name={field.name}
                      type={
                        field.type === 'money' || field.type === 'number'
                          ? 'number'
                          : (field.type ?? 'text')
                      }
                      min={field.type === 'number' || field.type === 'money' ? 0 : undefined}
                      step={
                        field.type === 'money' ? '0.01' : field.type === 'number' ? '1' : undefined
                      }
                      required={field.required !== false}
                      defaultValue={
                        value === undefined
                          ? ''
                          : field.type === 'money'
                            ? Number(value) / 100
                            : String(value).slice(0, field.type === 'date' ? 10 : undefined)
                      }
                    />
                  )}
                  {field.hint && <small>{field.hint}</small>}
                </label>
              );
            })}
          </div>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <footer>
            <button type="button" className="button" onClick={onClose}>
              Cancel
            </button>
            <button className="button primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save record'}
              <ArrowRight size={16} />
            </button>
          </footer>
        </form>
      </dialog>
    </div>
  );
}
