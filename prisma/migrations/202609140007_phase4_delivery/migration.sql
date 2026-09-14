CREATE TABLE "PushSubscription" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "payload" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "revokedAt" TIMESTAMP(3),
  CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX "PushSubscription_userId_createdAt_idx" ON "PushSubscription"("userId", "createdAt");
CREATE TABLE "NotificationDelivery" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "notificationKey" TEXT NOT NULL,
  "channel" TEXT NOT NULL, "status" TEXT NOT NULL, "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "error" TEXT,
  CONSTRAINT "NotificationDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "NotificationDelivery_channel_check" CHECK ("channel" IN ('EMAIL','PUSH')),
  CONSTRAINT "NotificationDelivery_status_check" CHECK ("status" IN ('SENT','FAILED','SKIPPED'))
);
CREATE UNIQUE INDEX "NotificationDelivery_userId_notificationKey_channel_key" ON "NotificationDelivery"("userId", "notificationKey", "channel");
CREATE INDEX "NotificationDelivery_userId_attemptedAt_idx" ON "NotificationDelivery"("userId", "attemptedAt");
