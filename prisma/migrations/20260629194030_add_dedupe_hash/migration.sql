-- AlterTable
ALTER TABLE "Milestone" ADD COLUMN "dedupeHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Milestone_dedupeHash_key" ON "Milestone"("dedupeHash");
