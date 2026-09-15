# Finance Assistant architecture and gap analysis

## Reused capabilities

MoneyPath already provided authoritative calculations through `calculate`, `safeToSpend`, `paymentPriority`, `simulatePurchase`, `salaryAllocation`, `spendingReport`, `financialActionPlan`, `emergencyAdjustment`, and `goalSummary`. The Finance Assistant calls these functions with a fresh database snapshot. It does not maintain separate balances or financial formulas.

The existing record service already applied income, expenses, card purchases, card payments, personal borrowing, investments, goals and cash advances as database transactions. Chat proposals use the same validated commands and service.

## Gaps addressed

- Natural Hinglish questions now cover live status, safe spending, purchase impact and ceiling, payment priority, shortfall, salary allocation, risk reasons, overspending, optional investments and marriage goals.
- Chat prepares salary, bank expense, emergency expense, card purchase, card payment, interest-free borrowing and cash-advance records.
- Card purchases increase expense and card debt without reducing bank cash. Card payments reduce bank cash and debt without adding a second expense.
- Purchase follow-ups retain the previous item, amount and payment method.
- The assistant page includes live summary cards, quick questions, Edit, Cancel and explicit confirmation controls.
- Confirmed chat writes carry an encrypted interpretation, conversation reference, source and confirmation flag in the audit trail.
- The most recent safe assistant-created income, expense, card purchase, cash advance or personal borrowing can be undone with balance checks. Unsafe reversals are refused.

## Data flow

1. The API authenticates the owner and loads a current snapshot with `readData`.
2. `chatReply` identifies the intent and calls the existing calculation or planning engine.
3. Read questions return only numbers produced from that snapshot.
4. Write requests return a validated command proposal; no financial row changes at this stage.
5. **Confirm and save** sends the proposal through the normal records API and serializable database transaction.
6. The transaction stores assistant audit metadata and recalculates the risk snapshot.
7. The page reloads the new database state and all plans use the updated values.

## Current limitations

- Natural-language date extraction is deliberately conservative. Chat entries default to today; complex future dates and multi-part goal creation still belong in the existing Goals form.
- Product-specific investment penalties, taxes and card cash-advance fees are not invented. The assistant identifies them as missing information.
- Undo is limited to transaction types that can be reversed exactly from current records. Card bill payments and commitment payments are excluded because later statement or recurrence changes can make reversal ambiguous.
- Proactive notifications continue to use deterministic planning notifications. More alert types can be added after their thresholds and deduplication periods are configured.
