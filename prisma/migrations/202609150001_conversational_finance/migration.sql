CREATE TABLE "ChatMessage" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "role" TEXT NOT NULL, "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "ChatMessage_role_check" CHECK ("role" IN ('USER','ASSISTANT'))
);
CREATE INDEX "ChatMessage_userId_createdAt_idx" ON "ChatMessage"("userId", "createdAt");
CREATE TABLE "CashAdvance" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "cardId" TEXT NOT NULL, "accountId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL, "date" DATE NOT NULL, "notes" TEXT,
  CONSTRAINT "CashAdvance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id"),
  CONSTRAINT "CashAdvance_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id"),
  CONSTRAINT "CashAdvance_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id"),
  CONSTRAINT "CashAdvance_amount_check" CHECK ("amount" > 0)
);
CREATE INDEX "CashAdvance_userId_date_idx" ON "CashAdvance"("userId", "date");
