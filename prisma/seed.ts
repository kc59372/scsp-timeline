/**
 * Database seed — verified US entries from the team's research.
 *
 * Sources: legacy/data.json (Manta Ray, Maven, GenAI.mil source URLs) and the
 * seed-data tables in CLAUDE.md (US systems, procurement contracts, policy
 * directives).
 *
 * RULES (per CLAUDE.md):
 *  - No fabricated data. Unknown fields are left null.
 *  - contractValue stored in RAW USD (not millions) for sortability.
 *  - All entries are country: US.
 *  - Entries are seeded as APPROVED (curated, human-verified research data —
 *    distinct from scraped data, which always enters as PENDING).
 *
 * Date helpers below construct UTC dates so partial dates (year-only,
 * year+month) are represented consistently.
 */
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

/** Year-only date → Jan 1 of that year (UTC). */
const y = (year: number) => new Date(Date.UTC(year, 0, 1));
/** Year + month (1-indexed) → 1st of that month (UTC). */
const ym = (year: number, month: number) => new Date(Date.UTC(year, month - 1, 1));

// ---------------------------------------------------------------------------
// US Systems (3) — from CLAUDE.md + legacy/data.json
// ---------------------------------------------------------------------------
const systems: Prisma.MilestoneCreateInput[] = [
  {
    name: "Maven Smart System",
    actor: "Palantir / DoD",
    country: "US",
    category: "TARGETING",
    subcategory: "Sensor-to-shooter / ATR",
    description:
      "Project Maven's Smart System, powered by Palantir, integrates AI/ML " +
      "targeting capabilities across the military services. It links machine " +
      "learning algorithms with command-and-control sensors to accelerate " +
      "targeting workflows and enhance battlespace situational awareness. " +
      "Underwent significant joint-force operational testing in Dec 2025, and " +
      "a major live exercise in May 2026 demonstrated rapid sensor-to-shooter " +
      "targeting, threat detection, and AI-assisted weapon-allocation " +
      "recommendations in a contested environment.",
    devStartDate: ym(2017, 4),
    testDate: ym(2025, 12),
    deploymentDate: ym(2026, 5),
    systemStatus: "FIELDED",
    entryStatus: "APPROVED",
    sourceUrl:
      "https://investors.palantir.com/news-details/2024/Palantir-Expands-Maven-Smart-System-AIML-Capabilities-to-Military-Services/",
    sourceName: "Palantir Expands Maven Smart System AI/ML Capabilities",
    additionalSources: [
      "https://www.cbsnews.com/news/ai-warfare-cbs-news-sees-us-military-exercise-robots-artificial-intelligence/",
    ],
    significance: 5,
  },
  {
    name: "GenAI.mil (Exercise Arctic Bridge)",
    actor: "USAF 732nd Air Mobility Squadron",
    country: "US",
    category: "TRAINING_SIMULATION",
    subcategory: "Generative AI / wargaming",
    description:
      "The 732nd Air Mobility Squadron used the custom GenAI.mil platform " +
      "(powered by Gemini) to run a specialized tabletop exercise in Alaska. " +
      "The system rapidly drafted complex scenario injects, logistical " +
      "challenges, and weather hazards tailored to sub-zero Arctic conditions, " +
      "reducing scenario planning times from weeks to minutes.",
    devStartDate: ym(2025, 12),
    deploymentDate: ym(2026, 6),
    testLocation: "Alaska",
    systemStatus: "FIELDED",
    entryStatus: "APPROVED",
    sourceUrl:
      "https://www.af.mil/News/Article-Display/Article/4507566/732nd-ams-leverages-artificial-intelligence-to-enhance-arctic-ttx/",
    sourceName: "732nd AMS leverages AI to enhance Arctic TTX (af.mil)",
    additionalSources: [],
    significance: 3,
  },
  {
    name: "Northrop Grumman Manta Ray XL-UUV",
    actor: "Northrop Grumman / DARPA",
    country: "US",
    category: "UNMANNED_SYSTEMS",
    subcategory: "Unmanned Maritime (XL-UUV)",
    description:
      "DARPA's Manta Ray prototype is an autonomous, energy-efficient " +
      "extra-large unmanned underwater vehicle, field-assemblable from five " +
      "shipping-container-sized pieces. It completed in-water testing of " +
      "propulsion, steering, and ballast operations off the coast of Southern " +
      "California, demonstrating long-range, high-endurance autonomous " +
      "underwater missions without on-site human support or hosting " +
      "infrastructure.",
    devStartDate: y(2020),
    testDate: ym(2024, 2),
    testLocation: "Southern California coast",
    systemStatus: "TESTING",
    entryStatus: "APPROVED",
    sourceUrl:
      "https://www.northropgrumman.com/what-we-do/mission-solutions/sensors/manta-ray",
    sourceName: "Northrop Grumman: Manta Ray Mission Solutions",
    additionalSources: [
      "https://www.darpa.mil/news/2024/manta-ray-uuv-prototype",
      "https://www.northropgrumman.com/what-we-do/mission-solutions/sensors/manta-ray/beneath-the-surface",
    ],
    significance: 4,
  },
];

// ---------------------------------------------------------------------------
// US Procurement Contracts — from CLAUDE.md table. contractValue in RAW USD.
// NOTE: CLAUDE.md says "+ all remaining contracts from the sheet", but the
// procurement spreadsheet is not present in the repo. Only the 5 explicitly
// listed contracts are seeded here. See the TODO log at the end of seeding.
// ---------------------------------------------------------------------------
const contracts: Prisma.MilestoneCreateInput[] = [
  {
    name: "AFRL Distributed C2 (Palantir / Booz Allen)",
    actor: "AFRL",
    country: "US",
    category: "PROCUREMENT_CONTRACT",
    description: "Distributed command-and-control contract under AFRL.",
    contractNumber: "FA875023S7006",
    contractValue: 99_000_000,
    issuingAgency: "AFRL",
    awardedTo: "Palantir / Booz Allen",
    entryStatus: "APPROVED",
    additionalSources: [],
    significance: 3,
  },
  {
    name: "JWCC Multi-Cloud (Joint Warfighting Cloud Capability)",
    actor: "WHS/DISA",
    country: "US",
    category: "PROCUREMENT_CONTRACT",
    description:
      "Joint Warfighting Cloud Capability — multi-cloud award spanning AWS, " +
      "Google, Microsoft, and Oracle.",
    contractNumber: "HQ003423D0019",
    contractValue: 9_000_000_000,
    issuingAgency: "WHS/DISA",
    awardedTo: "AWS, Google, Microsoft, Oracle",
    entryStatus: "APPROVED",
    additionalSources: [],
    significance: 5,
  },
  {
    name: "Project Maven ATR (Palantir)",
    actor: "ONR/NGA/CDAO",
    country: "US",
    category: "PROCUREMENT_CONTRACT",
    description: "Project Maven automatic target recognition (ATR) contract.",
    contractNumber: "N00014-24-C-XXXX",
    contractValue: 1_400_000_000,
    issuingAgency: "ONR/NGA/CDAO",
    awardedTo: "Palantir",
    entryStatus: "APPROVED",
    additionalSources: [],
    significance: 5,
  },
  {
    name: "Human-UAS Swarming (Mile Two LLC)",
    actor: "AFRL",
    country: "US",
    category: "PROCUREMENT_CONTRACT",
    description: "Human-UAS swarming research and development contract.",
    contractNumber: "FA8650-22-F-2611",
    contractValue: 14_780_000,
    issuingAgency: "AFRL",
    awardedTo: "Mile Two LLC",
    entryStatus: "APPROVED",
    additionalSources: [],
    significance: 2,
  },
  {
    name: "Tradewinds Marketplace (Scale AI, Anduril, C3 AI)",
    actor: "CDAO",
    country: "US",
    category: "PROCUREMENT_CONTRACT",
    description:
      "CDAO Tradewinds Marketplace — multi-award vehicle for AI/ML " +
      "capabilities. Value is multi-award (not a single fixed figure).",
    contractNumber: "W519TC-23-S-CTSM",
    contractValue: null, // Multi-award — no single value
    issuingAgency: "CDAO",
    awardedTo: "Scale AI, Anduril, C3 AI",
    entryStatus: "APPROVED",
    additionalSources: [],
    significance: 4,
  },
];

// ---------------------------------------------------------------------------
// US Policy Directives — from CLAUDE.md. Dates where known; sourceUrl left
// null where the repo provides none (flagged TODO, not fabricated).
// ---------------------------------------------------------------------------
const policies: Prisma.MilestoneCreateInput[] = [
  {
    name: "Third Offset Strategy",
    actor: "DoD",
    country: "US",
    category: "POLICY_DIRECTIVE",
    description:
      "DoD strategy emphasizing advanced technologies — including AI and " +
      "autonomy — to offset adversary capabilities.",
    devStartDate: y(2014),
    entryStatus: "APPROVED",
    additionalSources: [],
    significance: 4,
  },
  {
    name: "Establishment of the JAIC (Joint AI Center)",
    actor: "DoD",
    country: "US",
    category: "POLICY_DIRECTIVE",
    description:
      "Establishment of the Joint Artificial Intelligence Center to " +
      "accelerate AI adoption across the Department of Defense.",
    devStartDate: y(2018),
    entryStatus: "APPROVED",
    additionalSources: [],
    significance: 4,
  },
  {
    name: "DoD Ethical Principles for AI",
    actor: "DoD",
    country: "US",
    category: "POLICY_DIRECTIVE",
    description:
      "Department of Defense adoption of ethical principles for the use of " +
      "artificial intelligence.",
    devStartDate: y(2020),
    entryStatus: "APPROVED",
    additionalSources: [],
    significance: 3,
  },
  {
    name: "Establishment of the CDAO (Chief Digital and AI Office)",
    actor: "DoD",
    country: "US",
    category: "POLICY_DIRECTIVE",
    description:
      "Establishment of the Chief Digital and Artificial Intelligence Office, " +
      "consolidating DoD data and AI functions (absorbing the JAIC).",
    devStartDate: y(2022),
    entryStatus: "APPROVED",
    additionalSources: [],
    significance: 4,
  },
  {
    name: "Task Force Lima (Generative AI)",
    actor: "DoD / CDAO",
    country: "US",
    category: "POLICY_DIRECTIVE",
    description:
      "DoD task force established to assess, synchronize, and employ " +
      "generative AI capabilities across the department.",
    devStartDate: y(2023),
    entryStatus: "APPROVED",
    additionalSources: [],
    significance: 3,
  },
  {
    name: "Executive Order 14110 on Safe and Trustworthy AI",
    actor: "White House",
    country: "US",
    category: "POLICY_DIRECTIVE",
    description:
      "Executive Order on the Safe, Secure, and Trustworthy Development and " +
      "Use of Artificial Intelligence, with national-security provisions.",
    devStartDate: ym(2023, 10),
    entryStatus: "APPROVED",
    additionalSources: [],
    significance: 4,
  },
  {
    name: "NSPM-11 (National Security AI guidance)",
    actor: "White House",
    country: "US",
    category: "POLICY_DIRECTIVE",
    description:
      "National Security Presidential Memorandum addressing AI in the " +
      "national-security context.",
    devStartDate: ym(2026, 6),
    entryStatus: "APPROVED",
    additionalSources: [],
    significance: 4,
  },
  {
    name: "National Defense Strategy — AI guidance",
    actor: "DoD",
    country: "US",
    category: "POLICY_DIRECTIVE",
    description:
      "National Defense Strategy provisions providing guidance on the role of " +
      "artificial intelligence in US defense planning.",
    entryStatus: "APPROVED",
    additionalSources: [],
    significance: 3,
  },
];

async function main() {
  const all = [...systems, ...contracts, ...policies];

  console.log(`Seeding ${all.length} milestones...`);

  // Idempotent reset of milestone data so re-running the seed is safe.
  await prisma.milestone.deleteMany();

  for (const data of all) {
    await prisma.milestone.create({ data });
  }

  // ---- Verification: row counts by category ----
  const counts = await prisma.milestone.groupBy({
    by: ["category"],
    _count: { _all: true },
  });

  console.log("\nMilestone counts by category:");
  for (const row of counts.sort((a, b) => a.category.localeCompare(b.category))) {
    console.log(`  ${row.category.padEnd(22)} ${row._count._all}`);
  }
  const total = await prisma.milestone.count();
  console.log(`  ${"TOTAL".padEnd(22)} ${total}`);

  console.log(
    "\n⚠ TODO (incomplete data — see CLAUDE.md):\n" +
      "  • Procurement: only 5 contracts from CLAUDE.md are seeded. The full\n" +
      "    'Procurement Contracts' spreadsheet is not in the repo — supply it\n" +
      "    to seed the remaining contracts.\n" +
      "  • Policy: several directives have no source URL in the repo and were\n" +
      "    seeded with sourceUrl = null. Add verified sources before they go\n" +
      "    live (CLAUDE.md: no unsourced entries go public)."
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
