'use client';
import { useEffect, useState } from 'react';
import { chatReply, type ChatMemory, type ChatReply } from '@/lib/chat';
import { calculate, INR, type Data } from '@/lib/finance';
import { paymentPriority } from '@/lib/decision';
import { requestId } from '@/lib/request-id';

type Message = {
  role: 'USER' | 'ASSISTANT';
  content: string;
  details?: string[];
  draft?: ChatReply['draft'];
  confirmation?: string;
  userMessageId?: string;
};
export function FinanceAssistant({
  data,
  demo = false,
  compact = false,
}: {
  data: Data;
  demo?: boolean;
  compact?: boolean;
}) {
  const snapshot = calculate(data),
    nextPayment = paymentPriority(data).ranked[0];
  const [messages, setMessages] = useState<Message[]>([
      {
        role: 'ASSISTANT',
        content:
          'Hi Balaram. Ask what to do now, whether you can buy something, how to handle a shortfall, or tell me about salary, an expense or borrowing.',
      },
    ]),
    [input, setInput] = useState(''),
    [accountId, setAccountId] = useState(data.accounts.find((a) => a.spendable)?.id ?? ''),
    [cardId, setCardId] = useState(''),
    [memory, setMemory] = useState<ChatMemory>(),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (demo) return;
    void fetch('/api/chat')
      .then((r) => r.json())
      .then((body) => {
        if (body.messages?.length)
          setMessages(
            body.messages.map((item: { role: 'USER' | 'ASSISTANT'; content: string }) => {
              if (item.role === 'ASSISTANT') {
                try {
                  const parsed = JSON.parse(item.content);
                  return { role: item.role, content: parsed.answer, details: parsed.details };
                } catch {}
              }
              return item;
            }),
          );
      });
  }, [demo]);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message) return;
    setMessages((rows) => [...rows, { role: 'USER', content: message }]);
    setInput('');
    setBusy(true);
    try {
      let reply: ChatReply;
      let userMessageId: string | undefined;
      if (demo) reply = chatReply(data, message, { accountId, cardId, memory });
      else {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message,
              accountId: accountId || undefined,
              cardId: cardId || undefined,
            }),
          }),
          body = await response.json();
        if (!response.ok) throw new Error(body.error);
        reply = body;
        userMessageId = body.userMessageId;
      }
      setMemory(reply.memory);
      setMessages((rows) => [
        ...rows,
        {
          role: 'ASSISTANT',
          content: reply.answer,
          details: reply.details,
          draft: reply.draft,
          confirmation: reply.confirmation,
          userMessageId,
        },
      ]);
    } catch (error) {
      setMessages((rows) => [
        ...rows,
        {
          role: 'ASSISTANT',
          content: error instanceof Error ? error.message : 'Unable to answer.',
        },
      ]);
    } finally {
      setBusy(false);
    }
  }
  async function confirm(index: number, draft: ChatReply['draft'], userMessageId?: string) {
    if (!draft || demo) return;
    setBusy(true);
    try {
      const response = await fetch('/api/records', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': requestId(),
            'X-MoneyPath-Source': 'FINANCE_ASSISTANT',
            ...(userMessageId ? { 'X-MoneyPath-Message': userMessageId } : {}),
          },
          body: JSON.stringify(draft),
        }),
        body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setMessages((rows) => [
        ...rows.slice(0, index),
        { ...rows[index], draft: undefined, confirmation: undefined },
        ...rows.slice(index + 1),
        {
          role: 'ASSISTANT',
          content:
            'Saved. Dashboard, safe-to-spend, payment priorities and guidance have been recalculated.',
        },
      ]);
      setTimeout(() => location.reload(), 900);
    } catch (error) {
      setMessages((rows) => [
        ...rows,
        { role: 'ASSISTANT', content: error instanceof Error ? error.message : 'Unable to save.' },
      ]);
      setBusy(false);
    }
  }
  async function undo() {
    if (demo) return;
    setBusy(true);
    try {
      const response = await fetch('/api/chat/undo', { method: 'POST' }),
        body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setMessages((rows) => [
        ...rows,
        {
          role: 'ASSISTANT',
          content: `Most recent safe ${body.action} entry undo ho gayi. Financial plan recalculate kiya gaya hai.`,
        },
      ]);
      setTimeout(() => location.reload(), 900);
    } catch (error) {
      setMessages((rows) => [
        ...rows,
        { role: 'ASSISTANT', content: error instanceof Error ? error.message : 'Unable to undo.' },
      ]);
      setBusy(false);
    }
  }
  return (
    <div className={`planning finance-assistant ${compact ? 'compact' : ''}`}>
      <section className="panel planning-insights">
        <h2>Ask MoneyPath</h2>
        <p>
          I use your recorded data. I show a confirmation before any financial entry is saved, and I
          never silently assume missing amounts, accounts, fees or due dates.
        </p>
        <div className="planning-budget-form">
          <label>
            Default bank account
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Choose when recording</option>
              {data.accounts.map((a) => (
                <option value={a.id} key={a.id}>
                  {a.name} · {INR(a.balance)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Credit card, when relevant
            <select value={cardId} onChange={(e) => setCardId(e.target.value)}>
              <option value="">Choose card</option>
              {data.cards.map((card) => (
                <option value={card.id} key={card.id}>
                  {card.name} · debt {INR(card.outstanding)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="chat-status-grid">
          <div>
            <small>Safe to Spend</small>
            <strong>
              {snapshot.safe.available === null
                ? 'Information Required'
                : INR(snapshot.safe.available)}
            </strong>
          </div>
          <div>
            <small>Next Payment</small>
            <strong>
              {nextPayment ? `${nextPayment.name} · ${INR(nextPayment.amount)}` : 'None recorded'}
            </strong>
          </div>
          <div>
            <small>Credit Card Debt</small>
            <strong>{INR(snapshot.debt)}</strong>
          </div>
          <div>
            <small>Financial Risk</small>
            <strong>
              {snapshot.risk.score === null ? 'Information Required' : `${snapshot.risk.score}/100`}
            </strong>
          </div>
        </div>
        <div className="chat-quick-actions">
          {[
            'Abhi mujhe kya karna chahiye?',
            'Can I buy this?',
            'Abhi kis kis ko payment karna hai?',
            'Mere paas kitna paisa kharch karne ke liye hai?',
            'Mera risk high kyu hai?',
            'Marriage plan batao',
            'Aaj expense record karna hai',
            'Aaj salary record karna hai',
          ].map((label) => (
            <button
              type="button"
              className="button secondary"
              key={label}
              onClick={() => setInput(label)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>
      <section className="panel planning-insights chat-panel">
        <div className="chat-messages" aria-live="polite">
          {messages.map((message, index) => (
            <div className={`chat-message ${message.role.toLowerCase()}`} key={index}>
              <strong>{message.role === 'USER' ? 'You' : 'MoneyPath'}</strong>
              <p>{message.content}</p>
              {message.details?.map((detail) => (
                <p key={detail}>{detail}</p>
              ))}
              {message.draft && (
                <div>
                  <p>
                    <strong>{message.confirmation}</strong>
                  </p>
                  <button
                    className="button primary"
                    disabled={busy || demo}
                    onClick={() => confirm(index, message.draft, message.userMessageId)}
                  >
                    Confirm and save
                  </button>
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => setInput(messages[index - 1]?.content ?? '')}
                  >
                    Edit
                  </button>
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() =>
                      setMessages((rows) =>
                        rows.map((row, rowIndex) =>
                          rowIndex === index
                            ? {
                                ...row,
                                draft: undefined,
                                confirmation: undefined,
                                content: 'Cancelled. No record was changed.',
                              }
                            : row,
                        ),
                      )
                    }
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        <form className="chat-form" onSubmit={send}>
          <label>
            Message
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={500}
              placeholder="Example: Can I buy a phone for 25000?"
              required
            />
          </label>
          <button className="button primary" disabled={busy}>
            {busy ? 'Checking…' : 'Send'}
          </button>
        </form>
        {!demo && (
          <button type="button" className="button secondary" disabled={busy} onClick={undo}>
            Undo most recent safe chat entry
          </button>
        )}
      </section>
    </div>
  );
}
