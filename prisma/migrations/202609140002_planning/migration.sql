CREATE TABLE "SalaryPlan" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "incomeId" TEXT NOT NULL UNIQUE REFERENCES "Income"("id"),
  "essentialReserve" INTEGER NOT NULL CHECK ("essentialReserve" >= 0),
  "emergencyReserve" INTEGER NOT NULL CHECK ("emergencyReserve" >= 0),
  "goalReserve" INTEGER NOT NULL CHECK ("goalReserve" >= 0),
  "extraDebtReserve" INTEGER NOT NULL CHECK ("extraDebtReserve" >= 0),
  "cashAtAcceptance" DOUBLE PRECISION NOT NULL CHECK ("cashAtAcceptance" >= 0 AND "cashAtAcceptance" = floor("cashAtAcceptance")),
  "mandatoryAtAcceptance" DOUBLE PRECISION NOT NULL CHECK ("mandatoryAtAcceptance" >= 0 AND "mandatoryAtAcceptance" = floor("mandatoryAtAcceptance")),
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "SalaryPlan_userId_acceptedAt_idx" ON "SalaryPlan"("userId", "acceptedAt");
CREATE TABLE "DebtPlan" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE,
  "monthlyPayment" INTEGER NOT NULL CHECK ("monthlyPayment" > 0 AND "monthlyPayment" <= 1000000000),
  "strategy" TEXT NOT NULL CHECK ("strategy" IN ('AVALANCHE', 'SNOWBALL', 'CUSTOM')),
  "assumptions" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
ALTER TABLE "RiskSnapshot" ADD COLUMN "metrics" JSONB;
