ALTER TABLE "Audit" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'PORTAL';
ALTER TABLE "Audit" ADD COLUMN "conversationMessageId" TEXT;
ALTER TABLE "Audit" ADD COLUMN "interpretation" TEXT;
ALTER TABLE "Audit" ADD COLUMN "confirmedByUser" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Audit" ADD COLUMN "undoneAt" TIMESTAMP(3);
CREATE INDEX "Audit_userId_source_createdAt_idx" ON "Audit"("userId", "source", "createdAt");
