'use client';
import { useState } from 'react';
import { requestId } from '@/lib/request-id';
export function Integrations({ demo }: { demo: boolean }) {
  const [label, setLabel] = useState('My mobile app'),
    [token, setToken] = useState(''),
    [message, setMessage] = useState('');
  async function create() {
    if (demo) {
      setMessage('Set up your account before creating an API token.');
      return;
    }
    setMessage('');
    const r = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestId() },
        body: JSON.stringify({ label }),
      }),
      j = await r.json();
    if (!r.ok) {
      setMessage(j.error);
      return;
    }
    setToken(j.token);
    setMessage('Token created for 90 days. Copy it now; only its hash is stored.');
  }
  return (
    <div className="planning">
      <section className="panel planning-insights">
        <h2>Mobile API</h2>
        <p>
          Create a limited bearer token for the read-only summary endpoint{' '}
          <code>/api/mobile/v1/summary</code>. The endpoint returns calculated safe-to-spend, risk,
          priorities and reminders; it cannot post transactions.
        </p>
        <div className="planning-budget-form">
          <label>
            Device label
            <input value={label} maxLength={50} onChange={(e) => setLabel(e.target.value)} />
          </label>
          <button className="button primary" onClick={create}>
            Create 90-day token
          </button>
          {token && (
            <label>
              Copy this token now
              <textarea readOnly value={token} />
            </label>
          )}
          {message && <p role="status">{message}</p>}
        </div>
      </section>
      <section className="panel planning-insights">
        <h2>External integrations</h2>
        <p>
          Email, push and bank-statement providers require your chosen provider and credentials.
          MoneyPath keeps these connections disabled until configured; the accounting engine remains
          the source of every number.
        </p>
        <p>
          In-app notifications are active. External delivery adapters can consume the calculated
          notification feed without changing balances.
        </p>
      </section>
    </div>
  );
}
