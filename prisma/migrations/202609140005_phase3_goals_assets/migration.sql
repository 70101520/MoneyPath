CREATE TABLE "PersonalAdvance" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "entryId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL, "amount" INTEGER NOT NULL, "date" DATE NOT NULL, "notes" TEXT,
  CONSTRAINT "PersonalAdvance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id"),
  CONSTRAINT "PersonalAdvance_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "PersonalEntry"("id"),
  CONSTRAINT "PersonalAdvance_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id"),
  CONSTRAINT "PersonalAdvance_amount_check" CHECK ("amount" > 0)
);
CREATE INDEX "PersonalAdvance_userId_date_idx" ON "PersonalAdvance"("userId", "date");
CREATE TABLE "Investment" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "name" TEXT NOT NULL, "kind" TEXT NOT NULL,
  "contributed" INTEGER NOT NULL, "currentValue" INTEGER NOT NULL, "monthlyContribution" INTEGER NOT NULL,
  "nextContribution" DATE, "maturityDate" DATE, "liquid" BOOLEAN NOT NULL DEFAULT false, "notes" TEXT,
  CONSTRAINT "Investment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "Investment_amounts_check" CHECK ("contributed" >= 0 AND "currentValue" >= 0 AND "monthlyContribution" >= 0)
);
CREATE INDEX "Investment_userId_name_idx" ON "Investment"("userId", "name");
CREATE TABLE "InvestmentEvent" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "investmentId" TEXT NOT NULL, "accountId" TEXT,
  "kind" TEXT NOT NULL, "amount" INTEGER NOT NULL, "date" DATE NOT NULL, "notes" TEXT,
  CONSTRAINT "InvestmentEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id"),
  CONSTRAINT "InvestmentEvent_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment"("id"),
  CONSTRAINT "InvestmentEvent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id"),
  CONSTRAINT "InvestmentEvent_kind_check" CHECK ("kind" IN ('CONTRIBUTION','WITHDRAWAL','VALUATION')),
  CONSTRAINT "InvestmentEvent_amount_check" CHECK ("amount" >= 0)
);
CREATE INDEX "InvestmentEvent_userId_date_idx" ON "InvestmentEvent"("userId", "date");
CREATE TABLE "Goal" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "name" TEXT NOT NULL, "kind" TEXT NOT NULL,
  "targetDate" DATE NOT NULL, "familyContribution" INTEGER NOT NULL DEFAULT 0, "personalCash" INTEGER NOT NULL DEFAULT 0,
  "engagement" INTEGER NOT NULL DEFAULT 0, "travel" INTEGER NOT NULL DEFAULT 0, "shopping" INTEGER NOT NULL DEFAULT 0,
  "emergencyBuffer" INTEGER NOT NULL DEFAULT 0, "otherAmount" INTEGER NOT NULL DEFAULT 0,
  "alreadySaved" INTEGER NOT NULL DEFAULT 0, "confirmedMoney" INTEGER NOT NULL DEFAULT 0,
  "expectedMoney" INTEGER NOT NULL DEFAULT 0, "notes" TEXT,
  CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "Goal_kind_check" CHECK ("kind" IN ('MARRIAGE','OTHER')),
  CONSTRAINT "Goal_amounts_check" CHECK ("familyContribution" >= 0 AND "personalCash" >= 0 AND "engagement" >= 0 AND "travel" >= 0 AND "shopping" >= 0 AND "emergencyBuffer" >= 0 AND "otherAmount" >= 0 AND "alreadySaved" >= 0 AND "confirmedMoney" >= 0 AND "expectedMoney" >= 0)
);
CREATE INDEX "Goal_userId_targetDate_idx" ON "Goal"("userId", "targetDate");
