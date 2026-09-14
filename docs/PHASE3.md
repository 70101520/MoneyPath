# Phase 3 complete

Phase 3 is complete. Phases 1 and 2 remain available.

## Available in this increment

- Existing receivable/private-liability opening snapshots, including amounts already settled at opening, optional agreed dates, priorities and encrypted private references/notes.
- Partial/full receipts and repayments with account selection, settlement history, ownership checks, idempotency and serializable balance updates. Over-settlement, insufficient funds and settlements before the opening snapshot or previous settlement are rejected.
- Expected receipts are never spendable cash and are excluded from tracked net worth. Receiving principal credits the chosen account once without duplicating income; repaying private principal debits it once without creating an expense.
- Known private liabilities due through the next salary reserve their full unpaid amount. Later/undated liabilities require an explicit planned reserve: blank is unknown, zero is an intentional zero. A due amount replaces the manual reserve rather than adding to it.
- Dashboard private debt/expected-receipt totals, dated calendar events, payment priorities, reminders, salary-plan breakdown, account-flow reports and CSV settlement records.
- `personal-v3` risk snapshots include private liabilities in debt/income risk and tracked net worth, while card utilization and card payoff scenarios remain card-only. Earlier snapshot versions did not include private liabilities and are not backfilled.

## Using the screens

Choose **Money to receive** or **Money I owe**. Enter the original amount and any amount already settled, plus the date of that opening snapshot. Account opening balances must already reflect historical cash movements. Creating the snapshot does not transfer money. Leave an unknown date blank.

Use **Receive from** or **Repay** for subsequent principal settlements. Select the account actually used and the settlement date. Do not duplicate a settlement in Income, Expenses or Payments. Expected salary and new earnings belong in Income, not receivables. Record charged interest/fees separately as expenses.

Opening amounts and posted settlements are immutable; reference, notes, due dates, priority and planned reserve can be edited. There is no new-loan advance, lending transfer, write-off or reversal flow in this increment. The planned private reserve is separate from Settings' extra debt reserve; do not reserve the same amount twice.

## Completed final increment

- Investment products track contributions, current value, gain/loss, monthly plans, liquidity and maturity. Contributions and withdrawals move account cash once; valuation updates do not.
- Marriage and other goals separate confirmed savings from expected money and calculate the confirmed shortfall, months remaining and required monthly saving.
- The what-if simulator compares purchases, extra debt repayment, paused contributions, receivable arrival/failure and salary delay without writing transactions.
- New lending and borrowing move cash once and increase the matching personal principal balance without creating income or expense.
- The Excel-compatible workbook contains summary, transactions, investments and goals. CSV remains available.
- Database backup and restore use the tested PostgreSQL operator workflow in the README. Restore is performed into a new database and verified before switching rather than accepting a database dump through the public web process.

Phase 4 has started; see [PHASE4.md](PHASE4.md).

## Validation

On 14 September 2026: 60 finance/security/database tests passed, the optimized build and TypeScript checks passed, and all five Chromium workflows passed. Browser coverage includes real receipt/repayment forms, reload persistence, unchanged income/expense totals and mobile layout. Restore comparison passed across all 19 tables, including decrypted private references. VM deployment results are recorded in [DEPLOYMENT.md](DEPLOYMENT.md).

Revision `c043f99` is deployed on the testing VM. Its Docker build and all 60 tests passed there, followed by desktop/mobile LAN checks of both new pages and all eight Phase 2 pages. The database and matching environment were backed up before migration; full row counts/digests matched for all 16 pre-existing application tables. Existing owner data and credentials were preserved.
