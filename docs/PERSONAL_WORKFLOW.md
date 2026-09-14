# Personal money-management workflow

MoneyPath is designed to behave like a calm financial guide after the owner manually records each income, purchase, bill, repayment, investment movement or emergency expense.

The guidance order is:

1. Protect food, household needs, tuition, insurance continuity and other unavoidable payments.
2. Show bills due before the next salary and the amount that can be paid without consuming other protected money.
3. Stop or reduce categories that have crossed their recorded monthly budget.
4. Keep optional purchases within the current safe-to-spend amount and re-calculate after every entry.
5. Avoid new card spending while old card debt exists; apply only the debt payment approved by the salary plan.
6. If cash is short, review optional investment contributions and goal timing before reducing essential or minimum debt payments.
7. Keep expected receivables separate until received. Never assume that a friend or relative will repay on time.
8. For an emergency, use the recorded emergency reserve first, then safe-to-spend cash, optional investment contributions and a reviewed goal earmark. Show any remaining gap instead of silently recommending a loan.
9. Fund marriage and other goals from confirmed money and a monthly target. Show expected money separately.

Salary amount, salary day, accounts, card balances, commitments, budgets, investments and goals are user data. No personal amount is hard-coded into these rules or committed to Git.

## Conversational entry

Finance assistant chat supports common Hinglish/English questions and transaction phrases. It can prepare received salary, ordinary account expenses, new friend borrowing and credit-card cash advances. It always shows the interpreted amount and account/card before a separate confirmation saves the record. Purchase and shortfall questions are read-only. Chat history and any private transaction notes are encrypted in the database.

Credit-card cash advances increase the selected account and card debt once; they are not income. Because issuer fees and interest are unknown at withdrawal time, MoneyPath warns clearly and requires those charges to be recorded separately when known.
