ALTER TABLE "WaitlistSubmission" ALTER COLUMN "name" DROP NOT NULL;
ALTER TABLE "WaitlistSubmission" ALTER COLUMN "primaryPlatform" DROP NOT NULL;
ALTER TABLE "WaitlistSubmission" ALTER COLUMN "handle" DROP NOT NULL;
ALTER TABLE "WaitlistSubmission" ALTER COLUMN "niche" DROP NOT NULL;
ALTER TABLE "WaitlistSubmission" ALTER COLUMN "followerRange" DROP NOT NULL;
ALTER TABLE "WaitlistSubmission" ADD COLUMN "profileCompletedAt" TIMESTAMP(3);
