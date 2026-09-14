ALTER TABLE "Audit" ADD COLUMN "requestHash" TEXT;
ALTER TABLE "Account" ADD CONSTRAINT "account_nonnegative" CHECK (balance >= 0);
ALTER TABLE "Income" ADD CONSTRAINT "income_positive" CHECK (amount > 0);
ALTER TABLE "Expense" ADD CONSTRAINT "expense_positive" CHECK (amount > 0);
ALTER TABLE "Payment" ADD CONSTRAINT "payment_positive" CHECK (amount > 0);
ALTER TABLE "Card" ADD CONSTRAINT "card_balances_valid" CHECK ("creditLimit" > 0 AND outstanding >= 0 AND "statementPaid" >= 0 AND "statementAmount" >= "statementPaid" AND outstanding >= "statementAmount" - "statementPaid" AND "minimumDue" >= 0 AND "minimumDue" <= "statementAmount" AND ("availableLimit" IS NULL OR ("availableLimit" >= 0 AND "availableLimit" <= "creditLimit")));
ALTER TABLE "Commitment" ADD CONSTRAINT "commitment_reserve_valid" CHECK (amount > 0 AND "intervalMonths" >= 1 AND paid >= 0 AND funded >= 0 AND paid + funded <= amount);
ALTER TABLE "Emi" ADD CONSTRAINT "emi_principal_valid" CHECK ("originalAmount" > 0 AND "principalRemaining" >= 0 AND "principalRemaining" <= "originalAmount" AND "nextPrincipal" >= 0 AND "nextPrincipal" <= "principalRemaining" AND "nextInterest" >= 0 AND "installmentsPaid" >= 0 AND "installmentsPaid" <= "totalInstallments");
