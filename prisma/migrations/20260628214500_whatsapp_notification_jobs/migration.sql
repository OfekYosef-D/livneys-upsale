-- CreateEnum
CREATE TYPE "NotificationJobStatus" AS ENUM ('PENDING', 'DRY_RUN', 'SENT', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "NotificationEvent" ADD COLUMN "notificationJobId" TEXT,
ADD COLUMN "templateKey" TEXT,
ADD COLUMN "dryRun" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "providerMessageId" TEXT,
ADD COLUMN "providerStatus" TEXT;

-- CreateTable
CREATE TABLE "NotificationJob" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderId" TEXT,
    "reminderJobId" TEXT,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'WHATSAPP',
    "templateKey" TEXT NOT NULL,
    "templateName" TEXT,
    "status" "NotificationJobStatus" NOT NULL DEFAULT 'PENDING',
    "dryRun" BOOLEAN NOT NULL DEFAULT true,
    "payload" JSONB NOT NULL,
    "message" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppWebhookEvent" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "providerEventId" TEXT,
    "providerMessageId" TEXT,
    "kind" TEXT NOT NULL,
    "providerStatus" TEXT,
    "fromPhone" TEXT,
    "customerId" TEXT,
    "notificationJobId" TEXT,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationJob_dedupeKey_key" ON "NotificationJob"("dedupeKey");

-- CreateIndex
CREATE INDEX "NotificationJob_customerId_idx" ON "NotificationJob"("customerId");

-- CreateIndex
CREATE INDEX "NotificationJob_orderId_idx" ON "NotificationJob"("orderId");

-- CreateIndex
CREATE INDEX "NotificationJob_reminderJobId_idx" ON "NotificationJob"("reminderJobId");

-- CreateIndex
CREATE INDEX "NotificationJob_status_scheduledAt_idx" ON "NotificationJob"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "NotificationJob_providerMessageId_idx" ON "NotificationJob"("providerMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppWebhookEvent_dedupeKey_key" ON "WhatsAppWebhookEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "WhatsAppWebhookEvent_providerMessageId_idx" ON "WhatsAppWebhookEvent"("providerMessageId");

-- CreateIndex
CREATE INDEX "WhatsAppWebhookEvent_customerId_idx" ON "WhatsAppWebhookEvent"("customerId");

-- CreateIndex
CREATE INDEX "WhatsAppWebhookEvent_notificationJobId_idx" ON "WhatsAppWebhookEvent"("notificationJobId");

-- CreateIndex
CREATE INDEX "WhatsAppWebhookEvent_kind_idx" ON "WhatsAppWebhookEvent"("kind");

-- CreateIndex
CREATE INDEX "NotificationEvent_notificationJobId_idx" ON "NotificationEvent"("notificationJobId");

-- CreateIndex
CREATE INDEX "NotificationEvent_providerMessageId_idx" ON "NotificationEvent"("providerMessageId");

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_notificationJobId_fkey" FOREIGN KEY ("notificationJobId") REFERENCES "NotificationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationJob" ADD CONSTRAINT "NotificationJob_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationJob" ADD CONSTRAINT "NotificationJob_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationJob" ADD CONSTRAINT "NotificationJob_reminderJobId_fkey" FOREIGN KEY ("reminderJobId") REFERENCES "ReminderJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppWebhookEvent" ADD CONSTRAINT "WhatsAppWebhookEvent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppWebhookEvent" ADD CONSTRAINT "WhatsAppWebhookEvent_notificationJobId_fkey" FOREIGN KEY ("notificationJobId") REFERENCES "NotificationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
