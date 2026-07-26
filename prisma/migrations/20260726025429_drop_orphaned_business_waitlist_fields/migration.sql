-- Reconciles production with prisma/schema.prisma. Two independent drifts,
-- confirmed via `prisma migrate diff --from-config-datasource --to-schema`:
--
-- 1. Drops fields from 20260704000100_business_waitlist_leads, a migration
--    applied to production from a branch that never merged into main. The
--    "business waitlist" feature was never shipped; confirmed 0 rows had
--    leadType='BUSINESS' or any of these columns populated.
-- 2. Creates indexes declared via @@index in schema.prisma but never
--    actually run against production (added as "schema only, no migration
--    yet" prior to the migration history consolidation).
-- DropIndex
DROP INDEX "WaitlistSubmission_email_leadType_key";

-- AlterTable
ALTER TABLE "WaitlistSubmission" DROP COLUMN "budgetRange",
DROP COLUMN "companyName",
DROP COLUMN "companyType",
DROP COLUMN "industry",
DROP COLUMN "leadType";

-- DropEnum
DROP TYPE "WaitlistLeadType";

-- CreateIndex
CREATE INDEX "Application_creatorId_idx" ON "Application"("creatorId");

-- CreateIndex
CREATE INDEX "Application_status_idx" ON "Application"("status");

-- CreateIndex
CREATE INDEX "Campaign_brandId_idx" ON "Campaign"("brandId");

-- CreateIndex
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

-- CreateIndex
CREATE INDEX "Payout_creatorId_idx" ON "Payout"("creatorId");

-- CreateIndex
CREATE INDEX "Submission_applicationId_idx" ON "Submission"("applicationId");

-- CreateIndex
CREATE INDEX "Submission_creatorId_idx" ON "Submission"("creatorId");

-- CreateIndex
CREATE INDEX "Submission_status_idx" ON "Submission"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistSubmission_email_key" ON "WaitlistSubmission"("email");

-- CreateIndex
CREATE INDEX "WaitlistSubmission_referredById_idx" ON "WaitlistSubmission"("referredById");

-- CreateIndex
CREATE INDEX "WaitlistSubmission_status_idx" ON "WaitlistSubmission"("status");
