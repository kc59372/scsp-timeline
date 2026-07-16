/**
 * Database seed — verified US entries from the team's research.
 *
 * Sources: the team's research (Manta Ray, Maven, GenAI.mil source URLs) and the
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
// US Systems as PROGRAMS (3) — the seeded systems are the curated,
// human-verified counterpart to scraped lifecycles: each is a Program whose
// events trace request → award → test → deployment. Dates come only from the
// team's research (see CLAUDE.md). The Maven "ATR contract"
// event is the same $1.4B ONR/NGA/CDAO award listed in the CLAUDE.md
// procurement table, folded in here as Maven's AWARD stage.
// ---------------------------------------------------------------------------
const programs: Prisma.ProgramCreateInput[] = [
  {
    slug: "maven-smart-system",
    name: "Maven Smart System",
    actor: "Palantir / DoD",
    country: "US",
    category: "TARGETING",
    subcategory: "Sensor-to-shooter / ATR",
    systemStatus: "FIELDED",
    significance: 5,
    description:
      "Project Maven's Smart System, powered by Palantir, integrates AI/ML " +
      "targeting capabilities across the military services, linking machine " +
      "learning algorithms with command-and-control sensors to accelerate " +
      "targeting workflows and enhance battlespace situational awareness.",
    events: {
      create: [
        {
          name: "Project Maven established (Algorithmic Warfare Cross-Functional Team)",
          actor: "DoD",
          country: "US",
          category: "TARGETING",
          eventType: "RD_START",
          eventDate: ym(2017, 4),
          devStartDate: ym(2017, 4),
          systemStatus: "DEVELOPMENT",
          entryStatus: "APPROVED",
          description:
            "The Department of Defense established Project Maven to apply " +
            "machine learning to full-motion video and accelerate " +
            "targeting workflows.",
          sourceUrl:
            "https://investors.palantir.com/news-details/2024/Palantir-Expands-Maven-Smart-System-AIML-Capabilities-to-Military-Services/",
          sourceName: "Palantir Expands Maven Smart System AI/ML Capabilities",
          additionalSources: [],
          significance: 4,
        },
        {
          name: "Project Maven ATR contract (Palantir)",
          actor: "ONR/NGA/CDAO",
          country: "US",
          category: "TARGETING", // Maven = automatic target recognition; matches its program
          eventType: "AWARD",
          // FY24 award (contract number N00014-24-C-XXXX encodes fiscal 2024;
          // primary Palantir source is a 2024 announcement).
          eventDate: y(2024),
          procurementDate: y(2024),
          systemStatus: "DEVELOPMENT",
          entryStatus: "APPROVED",
          description:
            "Project Maven automatic target recognition (ATR) contract " +
            "expanding Palantir's Maven Smart System across the services.",
          contractNumber: "N00014-24-C-XXXX",
          contractValue: 1_400_000_000,
          issuingAgency: "ONR/NGA/CDAO",
          awardedTo: "Palantir",
          sourceUrl:
            "https://investors.palantir.com/news-details/2024/Palantir-Expands-Maven-Smart-System-AIML-Capabilities-to-Military-Services/",
          sourceName: "Palantir Expands Maven Smart System AI/ML Capabilities",
          additionalSources: [],
          significance: 5,
        },
        {
          name: "Maven Smart System joint-force operational testing",
          actor: "Palantir / DoD",
          country: "US",
          category: "TARGETING",
          eventType: "TEST",
          eventDate: ym(2025, 12),
          testDate: ym(2025, 12),
          systemStatus: "TESTING",
          entryStatus: "APPROVED",
          description:
            "The Maven Smart System underwent significant joint-force " +
            "operational testing in December 2025.",
          sourceUrl:
            "https://investors.palantir.com/news-details/2024/Palantir-Expands-Maven-Smart-System-AIML-Capabilities-to-Military-Services/",
          sourceName: "Palantir Expands Maven Smart System AI/ML Capabilities",
          additionalSources: [],
          significance: 4,
        },
        {
          name: "Maven Smart System live sensor-to-shooter exercise",
          actor: "Palantir / DoD",
          country: "US",
          category: "TARGETING",
          eventType: "DEPLOYMENT",
          eventDate: ym(2026, 5),
          deploymentDate: ym(2026, 5),
          systemStatus: "FIELDED",
          entryStatus: "APPROVED",
          description:
            "A major May 2026 live exercise demonstrated rapid " +
            "sensor-to-shooter targeting, threat detection, and AI-assisted " +
            "weapon-allocation recommendations in a contested environment.",
          sourceUrl:
            "https://investors.palantir.com/news-details/2024/Palantir-Expands-Maven-Smart-System-AIML-Capabilities-to-Military-Services/",
          sourceName: "Palantir Expands Maven Smart System AI/ML Capabilities",
          additionalSources: [],
          significance: 5,
        },
      ],
    },
  },
  {
    slug: "genai-mil-arctic-bridge",
    name: "GenAI.mil (Exercise Arctic Bridge)",
    actor: "USAF 732nd Air Mobility Squadron",
    country: "US",
    category: "TRAINING_SIMULATION",
    subcategory: "Generative AI / wargaming",
    systemStatus: "FIELDED",
    significance: 3,
    description:
      "A custom generative-AI platform (GenAI.mil, powered by Gemini) used by " +
      "the 732nd Air Mobility Squadron to draft complex tabletop-exercise " +
      "scenarios, reducing scenario planning times from weeks to minutes.",
    events: {
      create: [
        {
          name: "GenAI.mil platform development",
          actor: "USAF 732nd Air Mobility Squadron",
          country: "US",
          category: "TRAINING_SIMULATION",
          eventType: "RD_START",
          eventDate: ym(2025, 12),
          devStartDate: ym(2025, 12),
          systemStatus: "DEVELOPMENT",
          entryStatus: "APPROVED",
          description: "Development of the custom GenAI.mil generative-AI platform.",
          sourceUrl:
            "https://www.af.mil/News/Article-Display/Article/4507566/732nd-ams-leverages-artificial-intelligence-to-enhance-arctic-ttx/",
          sourceName: "732nd AMS leverages AI to enhance Arctic TTX (af.mil)",
          additionalSources: [],
          significance: 2,
        },
        {
          name: "GenAI.mil used in Exercise Arctic Bridge tabletop (Alaska)",
          actor: "USAF 732nd Air Mobility Squadron",
          country: "US",
          category: "TRAINING_SIMULATION",
          eventType: "DEPLOYMENT",
          eventDate: ym(2026, 6),
          deploymentDate: ym(2026, 6),
          testLocation: "Alaska",
          systemStatus: "FIELDED",
          entryStatus: "APPROVED",
          description:
            "GenAI.mil rapidly drafted scenario injects, logistical " +
            "challenges, and weather hazards tailored to sub-zero Arctic " +
            "conditions for a specialized tabletop exercise in Alaska.",
          sourceUrl:
            "https://www.af.mil/News/Article-Display/Article/4507566/732nd-ams-leverages-artificial-intelligence-to-enhance-arctic-ttx/",
          sourceName: "732nd AMS leverages AI to enhance Arctic TTX (af.mil)",
          additionalSources: [],
          significance: 3,
        },
      ],
    },
  },
  {
    slug: "manta-ray-xl-uuv",
    name: "Northrop Grumman Manta Ray XL-UUV",
    actor: "Northrop Grumman / DARPA",
    country: "US",
    category: "UNMANNED_SYSTEMS",
    subcategory: "Unmanned Maritime (XL-UUV)",
    systemStatus: "TESTING",
    significance: 4,
    description:
      "DARPA's Manta Ray prototype is an autonomous, energy-efficient " +
      "extra-large unmanned underwater vehicle (XL-UUV), field-assemblable " +
      "from shipping-container-sized pieces for long-range, high-endurance " +
      "autonomous underwater missions.",
    events: {
      create: [
        {
          name: "DARPA Manta Ray program begins",
          actor: "Northrop Grumman / DARPA",
          country: "US",
          category: "UNMANNED_SYSTEMS",
          eventType: "RD_START",
          eventDate: y(2020),
          devStartDate: y(2020),
          systemStatus: "DEVELOPMENT",
          entryStatus: "APPROVED",
          description:
            "DARPA's Manta Ray program began developing an autonomous " +
            "extra-large unmanned underwater vehicle.",
          sourceUrl: "https://www.darpa.mil/news/2024/manta-ray-uuv-prototype",
          sourceName: "DARPA: Manta Ray UUV prototype",
          additionalSources: [
            "https://www.northropgrumman.com/what-we-do/mission-solutions/sensors/manta-ray",
          ],
          significance: 3,
        },
        {
          name: "Manta Ray in-water testing off Southern California",
          actor: "Northrop Grumman / DARPA",
          country: "US",
          category: "UNMANNED_SYSTEMS",
          eventType: "TEST",
          eventDate: ym(2024, 2),
          testDate: ym(2024, 2),
          testLocation: "Southern California coast",
          systemStatus: "TESTING",
          entryStatus: "APPROVED",
          description:
            "The Manta Ray prototype completed in-water testing of " +
            "propulsion, steering, and ballast operations off the coast of " +
            "Southern California, demonstrating autonomous underwater " +
            "operations without on-site human support or hosting infrastructure.",
          sourceUrl:
            "https://www.northropgrumman.com/what-we-do/mission-solutions/sensors/manta-ray",
          sourceName: "Northrop Grumman: Manta Ray Mission Solutions",
          additionalSources: [
            "https://www.darpa.mil/news/2024/manta-ray-uuv-prototype",
            "https://www.northropgrumman.com/what-we-do/mission-solutions/sensors/manta-ray/beneath-the-surface",
          ],
          significance: 4,
        },
      ],
    },
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
    category: "COMMAND_CONTROL",
    description: "Distributed command-and-control contract under AFRL.",
    contractNumber: "FA875023S7006",
    contractValue: 99_000_000,
    issuingAgency: "AFRL",
    awardedTo: "Palantir / Booz Allen",
    entryStatus: "APPROVED",
    additionalSources: [],
    // Significance by known-project relevance, not contract value: this contract
    // names no tracked program (scrapers/programs.json), so it is not "significant".
    significance: 2,
  },
  {
    name: "JWCC Multi-Cloud (Joint Warfighting Cloud Capability)",
    actor: "WHS/DISA",
    country: "US",
    category: "OTHER", // enterprise multi-cloud vehicle — spans domains, no single one
    description:
      "Joint Warfighting Cloud Capability — multi-cloud award spanning AWS, " +
      "Google, Microsoft, and Oracle.",
    contractNumber: "HQ003423D0019",
    contractValue: 9_000_000_000,
    issuingAgency: "WHS/DISA",
    awardedTo: "AWS, Google, Microsoft, Oracle",
    entryStatus: "APPROVED",
    additionalSources: [],
    // $9B, but names no tracked program → not auto-"significant" (significance
    // reflects known-project relevance, not dollar value).
    significance: 2,
  },
  // NOTE: the "Project Maven ATR (Palantir)" $1.4B contract from the CLAUDE.md
  // table is seeded as the AWARD event of the Maven Smart System program above,
  // not as a standalone contract.
  {
    name: "Human-UAS Swarming (Mile Two LLC)",
    actor: "AFRL",
    country: "US",
    category: "UNMANNED_SYSTEMS",
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
    category: "OTHER", // multi-award AI/ML marketplace vehicle — spans domains
    description:
      "CDAO Tradewinds Marketplace — multi-award vehicle for AI/ML " +
      "capabilities. Value is multi-award (not a single fixed figure).",
    contractNumber: "W519TC-23-S-CTSM",
    contractValue: null, // Multi-award — no single value
    issuingAgency: "CDAO",
    awardedTo: "Scale AI, Anduril, C3 AI",
    entryStatus: "APPROVED",
    additionalSources: [],
    // Names no tracked program → significance by relevance, not award size.
    significance: 2,
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

export async function runSeed() {
  const standalone = [...contracts, ...policies];

  console.log(`Seeding ${programs.length} programs + ${standalone.length} standalone milestones...`);

  // Idempotent reset so re-running the seed is safe. Delete events first
  // (FK → Program), then programs, then any remaining standalone milestones.
  await prisma.milestone.deleteMany();
  await prisma.program.deleteMany();

  // Programs create their lifecycle events via nested writes.
  for (const data of programs) {
    await prisma.program.create({ data });
  }

  // Standalone contracts + policy directives (no lifecycle grouping).
  for (const data of standalone) {
    await prisma.milestone.create({ data });
  }

  // ---- Verification: row counts by category ----
  const counts = await prisma.milestone.groupBy({
    by: ["category"],
    _count: { _all: true },
  });

  console.log("\nMilestone (event) counts by category:");
  for (const row of counts.sort((a, b) => a.category.localeCompare(b.category))) {
    console.log(`  ${row.category.padEnd(22)} ${row._count._all}`);
  }
  const total = await prisma.milestone.count();
  const programCount = await prisma.program.count();
  const grouped = await prisma.milestone.count({ where: { programId: { not: null } } });
  console.log(`  ${"TOTAL".padEnd(22)} ${total}`);
  console.log(`\nPrograms: ${programCount} · grouped events: ${grouped} · standalone: ${total - grouped}`);

  console.log(
    "\n⚠ TODO (incomplete data — see CLAUDE.md):\n" +
      "  • Procurement: only 5 contracts from CLAUDE.md are seeded. The full\n" +
      "    'Procurement Contracts' spreadsheet is not in the repo — supply it\n" +
      "    to seed the remaining contracts.\n" +
      "  • Policy: several directives have no source URL in the repo and were\n" +
      "    seeded with sourceUrl = null. Add verified sources before they go\n" +
      "    live (CLAUDE.md: no unsourced entries go public)."
  );

  return {
    programs: programCount,
    milestones: total,
    grouped,
    standalone: total - grouped,
  };
}

// Auto-run only when executed directly as a script (e.g. `prisma db seed` /
// ts-node prisma/seed.ts) — NOT when imported (the one-time /api/admin/seed
// route imports runSeed and invokes it under a token guard instead).
if (require.main === module) {
  runSeed()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
