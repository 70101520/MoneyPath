# Phase 4 complete

Phase 4 is implemented with the deterministic finance engine as the authoritative source.

## Available

- The Finance assistant answers spending, payment-priority, risk, overspending and goal questions using only calculated MoneyPath data. It does not invent balances or post transactions.
- Read-only mobile access is available through `/api/mobile/v1/summary`. Owner-created bearer tokens are random, stored only as SHA-256 hashes, expire after 90 days and never grant transaction-write access.
- The mobile summary includes safe to spend, risk reasons, total debt, investment value, upcoming priorities and the notification feed.
- In-app notification rules remain active and can be consumed by a future delivery adapter without changing accounting records.
- A background worker delivers each calculated notification at most once per channel per day. SMTP email and encrypted standards-based Web Push subscriptions are supported; failed deliveries are recorded for inspection and retry.
- The bank-statement CSV importer validates and previews up to 100 income/expense rows, uses exact paise, applies normal account ownership/accounting rules and uses resumable idempotency keys.
- Owners can list and revoke mobile API tokens. Raw tokens are shown once and never stored.

## Provider activation

The code is complete. SMTP delivery remains disabled until the owner supplies an SMTP host/account. Web Push activates when a VAPID key pair is configured. CSV imports work without a bank connection. No external provider has access to financial data by default, and credentials never belong in Git.

An optional generative-AI provider can later rephrase the existing calculated answer object. It must not calculate financial values, write transactions or receive secrets that are unnecessary for the explanation.

## Validation

Revision `39788d5` is deployed on the testing VM. The optimized Docker build, all 68 tests, desktop/mobile LAN checks, protected-route checks and unauthorized notification-job rejection passed. A pre-migration database/environment backup was created at timestamp `20260914T182715Z`; all 23 pre-existing application-table fingerprints matched after migration. The scheduled notification worker is running successfully.
