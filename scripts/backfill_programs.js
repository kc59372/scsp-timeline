/**
 * One-time retroactive migration: group already-ingested PENDING events into
 * Program tracks using the curated registry (scrapers/programs.json).
 *
 * Mirrors scrapers/programs.py (matcher) and lib/ingest.ts (event dedup hash +
 * status ranking) so that:
 *   - matched events are linked to a Program (upserted by slug; existing/seeded
 *     programs keep their curated fields),
 *   - each linked event's dedupeHash is recomputed to the event-based hash
 *     (programSlug|eventType|eventDate|sourceUrl) so a FUTURE scrape of the same
 *     item is an idempotent upsert, not a duplicate,
 *   - a matched event adopts the program's canonical category,
 *   - each touched program's systemStatus is advanced (never downgraded) to its
 *     furthest-along event.
 * Unmatched events are left ungrouped for admin merge. PENDING-only; approved
 * data is untouched.
 *
 * Run inside the web container (has @prisma/client + DATABASE_URL). The registry
 * is injected as `globalThis.REGISTRY` by the runner so there is one source of
 * truth:
 *   REG=$(python3 -c "import json;print(json.dumps(json.load(open('scrapers/programs.json'))['programs']))")
 *   { printf 'globalThis.REGISTRY=%s;\n' "$REG"; cat scripts/backfill_programs.js; } \
 *     | docker compose -f docker-compose.prod.yml exec -T web node
 */
const { PrismaClient } = require("@prisma/client");
const { createHash } = require("crypto");
const prisma = new PrismaClient();

const REGISTRY = globalThis.REGISTRY;
if (!Array.isArray(REGISTRY)) {
  console.error("REGISTRY not injected — see header comment for the runner.");
  process.exit(1);
}

// Mirror of lib/ingest.ts EVENT_STATUS + STATUS_RANK.
const EVENT_STATUS = {
  RD_START: { status: "DEVELOPMENT", rank: 1 },
  SOLICITATION: { status: "DEVELOPMENT", rank: 2 },
  AWARD: { status: "DEVELOPMENT", rank: 3 },
  TEST: { status: "TESTING", rank: 4 },
  FIELDING: { status: "FIELDED", rank: 5 },
  DEPLOYMENT: { status: "FIELDED", rank: 6 },
  POLICY: { status: "UNKNOWN", rank: 0 },
  OTHER: { status: "UNKNOWN", rank: 0 },
};
const STATUS_RANK = { UNKNOWN: 0, DEVELOPMENT: 1, TESTING: 4, FIELDED: 5, CANCELLED: 99 };

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hasPhrase = (lower, phrase) => new RegExp(`(?<!\\w)${esc(phrase.toLowerCase())}(?!\\w)`).test(lower);
const hasAcronym = (text, acr) => new RegExp(`(?<!\\w)${esc(acr)}(?!\\w)`).test(text);

function matchProgram(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const e of REGISTRY) {
    if ((e.aliases || []).some((a) => hasPhrase(lower, a))) return e;
    if ((e.acronyms || []).some((a) => hasAcronym(text, a))) return e;
  }
  return null;
}

function eventHash(slug, eventType, eventDate, sourceUrl) {
  const key = `${slug}|${eventType}|${eventDate ? eventDate.toISOString() : ""}|${sourceUrl}`;
  return createHash("sha256").update(key).digest("hex");
}

(async () => {
  const rows = await prisma.milestone.findMany({
    where: { entryStatus: "PENDING", programId: null },
    select: {
      id: true, name: true, description: true, eventType: true,
      eventDate: true, sourceUrl: true, actor: true, country: true,
    },
  });

  let grouped = 0, duplicatesRemoved = 0, programsCreated = 0;
  const touched = new Set();
  const createdSlugs = new Set();

  for (const r of rows) {
    const p = matchProgram(`${r.name} ${r.description || ""}`);
    if (!p) continue;

    const before = await prisma.program.findUnique({ where: { slug: p.slug }, select: { id: true } });
    const prog = await prisma.program.upsert({
      where: { slug: p.slug },
      create: {
        slug: p.slug, name: p.name, actor: r.actor || "U.S. Department of Defense",
        country: r.country || "US", category: p.category, significance: 3,
      },
      update: {},
      select: { id: true },
    });
    if (!before) { programsCreated++; createdSlugs.add(p.slug); }
    touched.add(prog.id);

    const data = { program: { connect: { id: prog.id } }, category: p.category };
    if (r.eventType) data.dedupeHash = eventHash(p.slug, r.eventType, r.eventDate, r.sourceUrl || "");

    try {
      await prisma.milestone.update({ where: { id: r.id }, data });
      grouped++;
    } catch (e) {
      if (String(e.message || e).includes("Unique constraint")) {
        // Same event already linked (identical slug|type|date|url) → drop dup.
        await prisma.milestone.delete({ where: { id: r.id } });
        duplicatesRemoved++;
      } else throw e;
    }
  }

  // Advance (never downgrade) each touched program's systemStatus.
  for (const pid of touched) {
    const evs = await prisma.milestone.findMany({ where: { programId: pid }, select: { eventType: true } });
    const cur = await prisma.program.findUnique({ where: { id: pid }, select: { systemStatus: true } });
    let best = { status: null, rank: -1 };
    for (const e of evs) {
      const s = EVENT_STATUS[e.eventType];
      if (s && s.rank > best.rank) best = s;
    }
    const curRank = cur.systemStatus ? STATUS_RANK[cur.systemStatus] : -1;
    if (best.status && (STATUS_RANK[best.status] ?? 0) > curRank) {
      await prisma.program.update({ where: { id: pid }, data: { systemStatus: best.status } });
    }
  }

  console.log(JSON.stringify(
    { scanned: rows.length, grouped, duplicatesRemoved, programsCreated, createdSlugs: [...createdSlugs] },
    null, 2,
  ));
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
