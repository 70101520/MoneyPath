'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
export function Login() {
  const [register, setRegister] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: register ? 'register' : 'login',
          ...Object.fromEntries(form),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      location.assign('/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to connect');
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <section className="login-story">
        <Link href="/" className="brand">
          <span className="brand-mark">
            m<span>↗</span>
          </span>{' '}
          MoneyPath<span className="brand-dot">.</span>
        </Link>
        <div>
          <span className="eyebrow">A LITTLE CLARITY. A LOT MORE CONTROL.</span>
          <h1>
            Your money.
            <br />A clearer path.
          </h1>
          <p>
            Make room for what matters. Know what to pay, what to put aside, and what you can truly
            spend.
          </p>
        </div>
        <span className="privacy">
          <ShieldCheck size={18} /> Private by design. Yours to control.
        </span>
      </section>
      <section className="login-form">
        <span className="eyebrow">WELCOME TO MONEYPATH</span>
        <h2>{register ? 'Create your private space' : 'Good to see you again.'}</h2>
        <p>
          {register
            ? 'Set up the single owner account for this installation.'
            : 'Sign in to see where you stand.'}
        </p>
        <form onSubmit={submit}>
          {register && (
            <label>
              Your name
              <input name="name" autoComplete="name" required maxLength={80} />
            </label>
          )}
          <label>
            Email address
            <input type="email" name="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              autoComplete={register ? 'new-password' : 'current-password'}
              minLength={12}
              maxLength={128}
              required
            />
          </label>
          {register && (
            <label>
              Installation setup token
              <input type="password" name="setupToken" required />
              <small>Use SETUP_TOKEN from your server environment.</small>
            </label>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="button primary" disabled={busy}>
            {busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}
            <ArrowUpRight size={18} />
          </button>
        </form>
        <button
          className="text-button"
          onClick={() => {
            setRegister(!register);
            setError('');
          }}
        >
          {register ? 'Already set up? Sign in' : 'First time here? Set up your account'}
        </button>
        <Link className="demo-link" href="/demo">
          Explore with sample data →
        </Link>
      </section>
    </div>
  );
}
