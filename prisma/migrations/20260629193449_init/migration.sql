-- CreateEnum
CREATE TYPE "Category" AS ENUM ('UNMANNED_SYSTEMS', 'COMMAND_CONTROL', 'ISR', 'LOGISTICS_SUSTAINMENT', 'CYBER', 'TARGETING', 'POLICY_DIRECTIVE', 'PROCUREMENT_CONTRACT', 'TRAINING_SIMULATION', 'MEDICAL', 'SPACE', 'RESEARCH_DEVELOPMENT');

-- CreateEnum
CREATE TYPE "Country" AS ENUM ('US', 'CHINA', 'NATO', 'OTHER');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SystemStatus" AS ENUM ('DEVELOPMENT', 'TESTING', 'FIELDED', 'CANCELLED', 'UNKNOWN');

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "country" "Country" NOT NULL DEFAULT 'US',
    "category" "Category" NOT NULL,
    "subcategory" TEXT,
    "devStartDate" TIMESTAMP(3),
    "procurementDate" TIMESTAMP(3),
    "testDate" TIMESTAMP(3),
    "testLocation" TEXT,
    "fieldingDate" TIMESTAMP(3),
    "deploymentDate" TIMESTAMP(3),
    "entryStatus" "EntryStatus" NOT NULL DEFAULT 'PENDING',
    "systemStatus" "SystemStatus",
    "sourceUrl" TEXT,
    "sourceName" TEXT,
    "additionalSources" TEXT[],
    "contractNumber" TEXT,
    "contractValue" DOUBLE PRECISION,
    "issuingAgency" TEXT,
    "awardedTo" TEXT,
    "significance" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_MilestoneToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "_MilestoneToTag_AB_unique" ON "_MilestoneToTag"("A", "B");

-- CreateIndex
CREATE INDEX "_MilestoneToTag_B_index" ON "_MilestoneToTag"("B");

-- AddForeignKey
ALTER TABLE "_MilestoneToTag" ADD CONSTRAINT "_MilestoneToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MilestoneToTag" ADD CONSTRAINT "_MilestoneToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
