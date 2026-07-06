-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('RD_START', 'SOLICITATION', 'AWARD', 'TEST', 'FIELDING', 'DEPLOYMENT', 'POLICY', 'OTHER');

-- AlterTable
ALTER TABLE "Milestone" ADD COLUMN     "eventDate" TIMESTAMP(3),
ADD COLUMN     "eventType" "EventType",
ADD COLUMN     "programId" TEXT;

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "actor" TEXT NOT NULL,
    "country" "Country" NOT NULL DEFAULT 'US',
    "category" "Category" NOT NULL,
    "subcategory" TEXT,
    "systemStatus" "SystemStatus",
    "significance" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Program_slug_key" ON "Program"("slug");

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;
