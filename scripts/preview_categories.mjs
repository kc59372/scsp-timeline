#!/usr/bin/env node
/**
 * preview_categories.mjs — LOCAL PREVIEW ONLY.
 *
 * Inserts one APPROVED sample Milestone per Category so every category color is
 * visible on the timeline at once. All rows are named "Sample — <Category>" and
 * tagged sourceName "PREVIEW_SAMPLE" so they are trivially removable.
 *
 *   node scripts/preview_categories.mjs          # insert / refresh the 12 samples
 *   node scripts/preview_categories.mjs --clean  # delete them again
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const MARK = "PREVIEW_SAMPLE";

const CATEGORIES = [
  ["COMMAND_CONTROL", "Command & Control battle-management demo"],
  ["CYBER", "Autonomous cyber-defense agent evaluation"],
  ["ISR", "AI imagery-analysis sensor package"],
  ["LOGISTICS_SUSTAINMENT", "Predictive maintenance for fleet sustainment"],
  ["MEDICAL", "Battlefield triage decision-support tool"],
  ["POLICY_DIRECTIVE", "Directive on responsible AI adoption"],
  ["RESEARCH_DEVELOPMENT", "DARPA autonomy research program"],
  ["SPACE", "Space domain-awareness AI tracking"],
  ["TARGETING", "Sensor-to-shooter targeting pipeline"],
  ["TRAINING_SIMULATION", "AI-driven synthetic wargaming environment"],
  ["UNMANNED_SYSTEMS", "Autonomous unmanned surface vessel trial"],
  ["OTHER", "General AI/ML R&D effort (no single mission domain)"],
];

async function clean() {
  const { count } = await prisma.milestone.deleteMany({ where: { sourceName: MARK } });
  console.log(`Removed ${count} preview sample(s).`);
}

async function seed() {
  await clean(); // idempotent refresh
  let year = 2016;
  for (const [category, description] of CATEGORIES) {
    const label = category
      .split("_")
      .map((w) => w[0] + w.slice(1).toLowerCase())
      .join(" ");
    await prisma.milestone.create({
      data: {
        name: `Sample — ${label}`,
        description,
        actor: "Sample Program Office",
        category,
        entryStatus: "APPROVED",
        systemStatus: "TESTING",
        eventDate: new Date(`${year}-06-15T00:00:00Z`),
        deploymentDate: new Date(`${year}-06-15T00:00:00Z`),
        sourceUrl: "https://www.defense.gov/",
        sourceName: MARK,
        significance: 2,
      },
    });
    year++;
  }
  console.log(`Inserted ${CATEGORIES.length} approved preview samples (one per category).`);
}

const run = process.argv.includes("--clean") ? clean : seed;
run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
