'use client';
import { useState } from 'react';
import { explainFinance, type AssistantIntent } from '@/lib/assistant';
import { type Data } from '@/lib/finance';
import { paise } from './decisions';

export function FinanceAssistant({ data }: { data: Data }) {
  const [intent, setIntent] = useState<AssistantIntent>('TODAY'),
    [amount, setAmount] = useState('5000'),
    [answer, setAnswer] = useState<ReturnType<typeof explainFinance> | null>(null);
  return (
    <div className="planning">
      <section className="panel planning-insights">
        <h2>Ask using verified MoneyPath calculations</h2>
        <p>
          The assistant explains stored balances and deterministic results. It cannot invent
          transactions, balances, forecasts or financial advice.
        </p>
        <form
          className="planning-budget-form"
          onSubmit={(e) => {
            e.preventDefault();
            setAnswer(
              explainFinance(
                data,
                intent,
                ['SPEND', 'EMERGENCY'].includes(intent) ? paise(amount) : 0,
              ),
            );
          }}
        >
          <label>
            Question
            <select value={intent} onChange={(e) => setIntent(e.target.value as AssistantIntent)}>
              <option value="TODAY">What should I do now?</option>
              <option value="SPEND">Can I spend this amount?</option>
              <option value="EMERGENCY">How do I adjust an emergency expense?</option>
              <option value="PAY">Which bill should I pay first?</option>
              <option value="RISK">Why is my risk high?</option>
              <option value="OVERSPEND">Where did I overspend?</option>
              <option value="GOAL">How am I doing on my first goal?</option>
            </select>
          </label>
          {(intent === 'SPEND' || intent === 'EMERGENCY') && (
            <label>
              Amount (INR)
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                required
              />
            </label>
          )}
          <button className="button primary">Explain my numbers</button>
        </form>
      </section>
      {answer && (
        <section className="panel planning-insights" aria-live="polite">
          <h2>{answer.title}</h2>
          <p>{answer.answer}</p>
          {answer.facts.map((f) => (
            <p key={f}>{f}</p>
          ))}
        </section>
      )}
    </div>
  );
}
