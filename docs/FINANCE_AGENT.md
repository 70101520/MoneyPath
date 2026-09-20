# General-reasoning Finance Assistant

The authenticated Finance Assistant uses a two-stage AI planner and deterministic MoneyPath engines.

1. The model interprets unrestricted Hindi, English, Hinglish, spelling mistakes, and conversation context. It selects finance queries and may propose a transaction type.
2. MoneyPath executes the selected queries locally. Cash, safe-to-spend, shortfall, card debt, payment priorities, spending, goals, and hypothetical cash-outflow results come from deterministic application code.
3. The model writes a natural answer from that fact packet. Its instructions prohibit inventing or recalculating numbers.
4. A proposed mutation is converted to an existing validated command. It is returned as a draft and cannot reach `/api/records` until the owner presses **Confirm**. Advice and hypothetical questions never create drafts.

The model receives the current question, a short recent conversation, account/card/goal names, and only the deterministic facts selected for the answer. Requests set `store: false`. The API key remains server-side.

Configure:

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.5
```

Without `OPENAI_API_KEY`, MoneyPath retains the older local assistant as a fallback. The read-only demo also remains local so it does not consume API credits.

## Evaluation

Run the live 30-question suite after configuring the key:

```sh
npm run eval:finance-agent
```

The suite covers unrestricted advice, possible outflows, card questions, priorities, spending, goals, hypothetical emergencies, Hindi/Hinglish/English wording, typos, explicit transactions, transfers requiring clarification, and attempts to bypass confirmation. Reports are written to ignored private files:

- `artifacts/finance-agent-eval.json`
- `artifacts/finance-agent-eval.md`

Every case requires a non-empty answer. Read-only questions must not produce a mutation draft. Explicit supported transactions must produce a confirmation-gated draft.
