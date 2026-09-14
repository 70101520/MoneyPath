ALTER TABLE "Card" ADD COLUMN "lateFee" INTEGER CHECK ("lateFee" IS NULL OR ("lateFee" >= 0 AND "lateFee" <= 1000000000));
ALTER TABLE "Commitment" ADD COLUMN "lateFee" INTEGER CHECK ("lateFee" IS NULL OR ("lateFee" >= 0 AND "lateFee" <= 1000000000));
