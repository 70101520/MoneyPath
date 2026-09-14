'use client';
import { useEffect, useState } from 'react';
import { requestId } from '@/lib/request-id';
import { type Data } from '@/lib/finance';
import { BankImport } from './bank-import';
export function Integrations({ demo, data }: { demo: boolean; data: Data }) {
  const [label, setLabel] = useState('My mobile app'),
    [token, setToken] = useState(''),
    [message, setMessage] = useState(''),
    [tokens, setTokens] = useState<
      {
        id: string;
        label: string;
        expiresAt: string;
        lastUsedAt: string | null;
        revokedAt: string | null;
      }[]
    >([]);
  async function loadTokens() {
    if (demo) return;
    const response = await fetch('/api/tokens'),
      body = await response.json();
    if (response.ok) setTokens(body.tokens);
  }
  useEffect(() => {
    void loadTokens();
  }, [demo]);
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
    await loadTokens();
  }
  async function revoke(id: string) {
    const response = await fetch('/api/tokens', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      }),
      body = await response.json();
    setMessage(response.ok ? 'Token revoked.' : body.error);
    if (response.ok) await loadTokens();
  }
  async function enablePush() {
    try {
      if (demo) throw new Error('Set up your account first.');
      if (!('serviceWorker' in navigator) || !('PushManager' in window))
        throw new Error('This browser does not support web push.');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Notification permission was not granted.');
      const keyResponse = await fetch('/api/push'),
        keyBody = await keyResponse.json();
      if (!keyBody.publicKey) throw new Error('Push delivery is not configured on the server.');
      const registration = await navigator.serviceWorker.register('/moneypath-sw.js'),
        raw = keyBody.publicKey.replace(/-/g, '+').replace(/_/g, '/'),
        bytes = Uint8Array.from(atob(raw.padEnd(Math.ceil(raw.length / 4) * 4, '=')), (c) =>
          c.charCodeAt(0),
        ),
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: bytes,
        });
      const saved = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      });
      if (!saved.ok) throw new Error((await saved.json()).error);
      setMessage('Push notifications enabled on this browser.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to enable push.');
    }
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
          {tokens.map((item) => (
            <p key={item.id}>
              {item.label} · expires {item.expiresAt.slice(0, 10)} ·{' '}
              {item.revokedAt ? 'Revoked' : item.lastUsedAt ? 'Used' : 'Never used'}{' '}
              {!item.revokedAt && (
                <button className="text-button" onClick={() => revoke(item.id)}>
                  Revoke
                </button>
              )}
            </p>
          ))}
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
          In-app notifications are active. Scheduled SMTP email and standards-based Web Push use the
          same calculated feed without changing balances.
        </p>
        <button className="button" onClick={enablePush}>
          Enable browser push
        </button>
      </section>
      <BankImport data={data} demo={demo} />
    </div>
  );
}
