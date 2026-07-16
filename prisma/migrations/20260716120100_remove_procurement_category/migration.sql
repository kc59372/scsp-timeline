-- AlterEnum
-- Remove PROCUREMENT_CONTRACT. Postgres cannot drop a value from an enum in
-- place, so the type is recreated without it (standard Prisma pattern). This
-- REQUIRES that no Milestone/Program row still references PROCUREMENT_CONTRACT —
-- the category backfill (scripts/backfill_categories.ts) runs before this
-- migration and reassigns every such row to an inferred domain or OTHER.
BEGIN;
CREATE TYPE "Category_new" AS ENUM ('UNMANNED_SYSTEMS', 'COMMAND_CONTROL', 'ISR', 'LOGISTICS_SUSTAINMENT', 'CYBER', 'TARGETING', 'POLICY_DIRECTIVE', 'TRAINING_SIMULATION', 'MEDICAL', 'SPACE', 'RESEARCH_DEVELOPMENT', 'OTHER');
ALTER TABLE "Milestone" ALTER COLUMN "category" TYPE "Category_new" USING ("category"::text::"Category_new");
ALTER TABLE "Program" ALTER COLUMN "category" TYPE "Category_new" USING ("category"::text::"Category_new");
ALTER TYPE "Category" RENAME TO "Category_old";
ALTER TYPE "Category_new" RENAME TO "Category";
DROP TYPE "Category_old";
COMMIT;
