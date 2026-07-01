-- AlterEnum
ALTER TYPE "NotificationJobStatus" ADD VALUE 'PROCESSING';

-- AlterTable
ALTER TABLE "NotificationJob" ADD COLUMN "nextAttemptAt" TIMESTAMP(3),
ADD COLUMN "lastAttemptAt" TIMESTAMP(3),
ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 3;

-- CreateIndex
CREATE INDEX "NotificationJob_nextAttemptAt_idx" ON "NotificationJob"("nextAttemptAt");
