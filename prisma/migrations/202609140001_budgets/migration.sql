CREATE TABLE "Budget" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "month" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Budget_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Budget_amount_check" CHECK ("amount" >= 0 AND "amount" <= 1000000000),
  CONSTRAINT "Budget_month_check" CHECK ("month" ~ '^(20[0-9]{2}|2100)-(0[1-9]|1[0-2])$'),
  CONSTRAINT "Budget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Budget_userId_month_category_key" ON "Budget"("userId", "month", "category");
