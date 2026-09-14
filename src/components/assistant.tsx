'use client';
import { useEffect, useState } from 'react';
import { chatReply, type ChatReply } from '@/lib/chat';
import { INR, type Data } from '@/lib/finance';
import { requestId } from '@/lib/request-id';

type Message = {
  role: 'USER' | 'ASSISTANT';
  content: string;
  details?: string[];
  draft?: ChatReply['draft'];
  confirmation?: string;
};
export function FinanceAssistant({ data, demo = false }: { data: Data; demo?: boolean }) {
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
      if (demo) reply = chatReply(data, message, { accountId, cardId });
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
      }
      setMessages((rows) => [
        ...rows,
        {
          role: 'ASSISTANT',
          content: reply.answer,
          details: reply.details,
          draft: reply.draft,
          confirmation: reply.confirmation,
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
  async function confirm(index: number, draft: ChatReply['draft']) {
    if (!draft || demo) return;
    setBusy(true);
    try {
      const response = await fetch('/api/records', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestId() },
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
  return (
    <div className="planning">
      <section className="panel planning-insights">
        <h2>Chat with MoneyPath</h2>
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
                    onClick={() => confirm(index, message.draft)}
                  >
                    Confirm and save
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
      </section>
    </div>
  );
}
