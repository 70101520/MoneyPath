CREATE TABLE "PersonalEntry" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "direction" TEXT NOT NULL CHECK ("direction" IN ('RECEIVABLE','PAYABLE')),
  "reference" TEXT NOT NULL,
  "amount" INTEGER NOT NULL CHECK ("amount" > 0 AND "amount" <= 1000000000),
  "openingSettled" INTEGER NOT NULL DEFAULT 0 CHECK ("openingSettled" >= 0),
  "settled" INTEGER NOT NULL DEFAULT 0,
  "openingDate" DATE NOT NULL,
  "dueDate" DATE,
  "priority" TEXT NOT NULL DEFAULT 'NORMAL' CHECK ("priority" IN ('HIGH','NORMAL','LOW')),
  "paymentReserve" INTEGER,
  "notes" TEXT,
  CONSTRAINT "PersonalEntry_settled_check" CHECK ("openingSettled" <= "settled" AND "settled" <= "amount"),
  CONSTRAINT "PersonalEntry_reserve_check" CHECK ("paymentReserve" IS NULL OR ("paymentReserve" >= 0 AND "paymentReserve" <= "amount" - "settled"))
);
CREATE INDEX "PersonalEntry_userId_direction_idx" ON "PersonalEntry"("userId", "direction");
CREATE TABLE "PersonalSettlement" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON UPDATE CASCADE,
  "entryId" TEXT NOT NULL REFERENCES "PersonalEntry"("id") ON UPDATE CASCADE,
  "accountId" TEXT NOT NULL REFERENCES "Account"("id") ON UPDATE CASCADE,
  "amount" INTEGER NOT NULL CHECK ("amount" > 0 AND "amount" <= 1000000000),
  "date" DATE NOT NULL,
  "notes" TEXT
);
CREATE INDEX "PersonalSettlement_userId_date_idx" ON "PersonalSettlement"("userId", "date");
