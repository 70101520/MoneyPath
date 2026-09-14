ALTER TABLE "Card" ADD COLUMN "carriedBalance" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Card" ADD COLUMN "carriedDueDate" DATE;
ALTER TABLE "Card" ADD CONSTRAINT "carried_balance_valid" CHECK ("carriedBalance" >= 0 AND "carriedBalance" <= "statementAmount" - "statementPaid" AND ("carriedBalance" = 0 OR "carriedDueDate" IS NOT NULL));
CREATE TABLE "CardStatement" (
  "id" TEXT NOT NULL,
  "cardId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "paid" INTEGER NOT NULL,
  "statementDate" DATE NOT NULL,
  "dueDate" DATE NOT NULL,
  "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CardStatement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CardStatement_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
