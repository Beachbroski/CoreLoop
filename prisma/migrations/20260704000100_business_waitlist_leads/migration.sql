-- Add business lead support to the existing waitlist table.
CREATE TYPE "WaitlistLeadType" AS ENUM ('CREATOR', 'BUSINESS');

ALTER TABLE "WaitlistSubmission"
  ADD COLUMN "leadType" "WaitlistLeadType" NOT NULL DEFAULT 'CREATOR',
  ADD COLUMN "companyName" TEXT,
  ADD COLUMN "companyType" TEXT,
  ADD COLUMN "budgetRange" TEXT,
  ADD COLUMN "industry" TEXT;

DROP INDEX "WaitlistSubmission_email_key";

CREATE UNIQUE INDEX "WaitlistSubmission_email_leadType_key"
  ON "WaitlistSubmission"("email", "leadType");
