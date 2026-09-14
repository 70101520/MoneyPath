# Phase 2: planning and decisions

Phase 1 requirements passed their implementation, accounting, responsive-browser and Docker checks before Phase 2 started. The Phase 2 feature set is now implemented. Phases 3 and 4 remain pending.

## Implemented: budgets and spending analysis

- Monthly category budgets with saved edits, case-insensitive category matching, integer-paise limits, owner isolation, audit logging and idempotent submissions.
- Budget versus actual, remaining amount, percentage used, 90% alerts, over-budget status and spending without a budget. An absent budget displays Information Required; an explicit zero is a real zero limit.
- Spending analysis by category, essentiality, card spending and family support, with previous-calendar-month comparisons. Card repayments and investment contributions remain separate from expenses.
- Received income excludes expected funds. Missing previous spending does not produce an invented percentage. Reports describe recorded data; they do not assume records are complete.
- Budgets are tracking limits and do not create additional cash reservations. The versioned Phase 2 risk engine now considers recorded budget overruns.

Open **Budgets** or **Spending analysis** in navigation. Select the month, enter a category and INR limit, then save. Saving that category again updates its limit for the selected month. The sample workspace remains read-only.

## Salary plan

Select a received salary, review the mandatory allocation by commitment category, card statements and unposted EMI, and edit the four cash reserves. Acceptance replaces the current living, emergency, goal and extra-debt reserves. Salary is already included in the account balance and is never credited again. Plans are linked to received salary, audited and idempotent. A changed source-data fingerprint requires refreshing before acceptance; incomplete or underfunded plans cannot be accepted. Essential living remains the amount needed until salary and should be reviewed after spending.

## Payment priorities

Payments due through the next salary take precedence over more distant reserves. Within this group, overdue and near-due bills, insurance continuity, essentiality, recorded APR and optional potential late fees determine priority. Each payable amount preserves every other recorded cash reservation. Recheck after each payment; the list is not a batch-payment instruction. Later recurring occurrences cannot be paid before the current one. Unposted EMI remains a reserve until posted.

Potential late fees can be recorded on this screen. Blank means unknown; zero is an explicit no-fee value. A potential fee affects priority only. Actually charged fees must be recorded as expenses separately.

## Can I buy this?

Enter item, price, category, funding account/card and essentiality. The deterministic preview shows green/yellow/orange/red outcomes with cash, debt, utilization, shortfall, safe-to-spend and risk explanations. It checks the selected account/card, existing obligations and reserves, and reserves a card purchase's full repayment immediately. Nothing is posted or deducted by simulation. Missing financial data is shown as Information Required.

## Get out of debt

Compare avalanche, snowball and custom priority, with a saved monthly payment and per-card APR, minimum and priority assumptions. The schedule shows target, interest, payments, remaining debt, card payoff dates and a debt-free month. Compare modeled interest between avalanche and snowball at the same payment. Underfunded minimums, non-amortizing balances, missing assumptions and the 600-month limit have explicit outcomes.

The model starts payments next month, charges annual APR divided by 12 monthly (rounded up to paise), uses fixed entered minimums, and assumes no new borrowing, fees or income changes. Modeled balances include unbilled EMI principal; cards with EMI require an explicit blended forecast APR. This is a simplified scenario, not an issuer amortization or foreclosure quotation. Saving requires confirming assumptions and does not execute payments or reserve cash. Today’s protected debt capacity is shown separately from hypothetical monthly affordability.

## Notifications, reports and risk

In-app reminders cover bills due within seven days, overdue payments, budgets at 90% or exceeded, low safe-to-spend, new debt exceeding payments, increased card spending and long-cycle commitments due within 60 days. They refresh when the app is read. Background email/push delivery is Phase 4.

Reports cover twelve calendar months of recorded income/expenses, account flows, categories (Spending analysis), new card debt, repayments, net debt reduction, investment transfers, budget performance, debt/net-worth snapshots and risk history. Card payments are not counted as new expenses. Internal investment transfers are excluded from net account flows. Current months and incomplete records are identified. Balance snapshots are not invented for earlier months; net worth covers recorded accounts minus card/EMI debt, excluding Phase 3 assets and liabilities. Snapshot month boundaries use Asia/Kolkata. Risk events retain their original version and explanations; the detailed list shows the latest 100 events and the monthly report uses all saved history.

`planning-v2` retains the basic rules and adds: budget overrun +10, recorded expenses above received income +10, negative recorded account flow +10, new card debt exceeding repayments +10 (or net reduction -5), debt above a known prior-month snapshot +5, and no recorded investment contributions against received income +5. The contribution rule does not claim that other savings are zero. Final scores clamp to 0–100; versions should not be compared directly. Missing budgets/history are not treated as known zero data.

## Validation

On 14 September 2026: optimized build and TypeScript passed; 34 finance/security/database tests passed; four Chromium workflows passed, including saved budget persistence and mobile overflow checks. A dump/restore comparison passed across all 15 tables with encrypted-field and balance-constraint checks. The new migration only adds the Budget table and does not rewrite existing financial records.

The original budgets increment was deployed as `6fbd595`. The full Phase 2 release adds two plan tables, nullable historical balance metrics and optional priority costs without rewriting posted transactions. Local checks passed: optimized build, strict TypeScript, five browser workflows including all mobile screens, saved plans and purchase non-mutation, and a restore comparison across all 17 tables. Request IDs now use cryptographic random bytes that also work on the HTTP testing VM; browser persistence checks explicitly disable the secure-context-only randomUUID API.

Final local release checks: 51 finance/security/database tests passed, all five Chromium workflows passed, and formatting checks passed. VM deployment verification is recorded in [DEPLOYMENT.md](DEPLOYMENT.md).
