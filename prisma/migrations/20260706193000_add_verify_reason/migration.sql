-- AlterTable
-- IF NOT EXISTS so a manual pre-apply (one-off verifier backfill) and a later
-- `prisma migrate deploy` on redeploy are both safe / idempotent.
ALTER TABLE "Milestone" ADD COLUMN IF NOT EXISTS "verifyReason" TEXT;
