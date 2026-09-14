# Phase 4 progress

Phase 4 has started with secure foundations that keep the deterministic finance engine authoritative.

## Available

- The Finance assistant answers spending, payment-priority, risk, overspending and goal questions using only calculated MoneyPath data. It does not invent balances or post transactions.
- Read-only mobile access is available through `/api/mobile/v1/summary`. Owner-created bearer tokens are random, stored only as SHA-256 hashes, expire after 90 days and never grant transaction-write access.
- The mobile summary includes safe to spend, risk reasons, total debt, investment value, upcoming priorities and the notification feed.
- In-app notification rules remain active and can be consumed by a future delivery adapter without changing accounting records.

## Provider activation still required

Email, push and bank-statement connections require the owner's provider choices and credentials. They remain disabled until configured. No external provider has access to financial data, and no credentials belong in Git.

An optional generative-AI provider can later rephrase the existing calculated answer object. It must not calculate financial values, write transactions or receive secrets that are unnecessary for the explanation.
