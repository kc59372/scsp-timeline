# CLAUDE.md — US Military AI Adoption Timeline & Analysis Platform

## Project Overview

A **US military AI adoption tracker** for Washington policymakers and Silicon Valley developers. The site surfaces military AI milestones — procurement contracts, fielded systems, policy directives, and technology developments — with filtering, comparison, and trend analysis. Scope: 2016–2026, US-focused.

Visual design reference: [SCSP Space Race](https://www.scsp.ai/space-race/)

**Status:** MVP built and operational (Phases 1–6 complete), plus two post-MVP additions — **program-lifecycle tracking** (events grouped into program tracks) and a **historical `.mil`/`.gov` backfill** to 2016. This document is the product spec + build history and the source of truth; keep it in sync as the system evolves.

**Sourcing policy:** ingestion is restricted to official **.mil / .gov** endpoints and public-domain DoD media (DVIDS). Commercial news feeds (Breaking Defense, DefenseScoop, C4ISRNET, etc.) were removed to avoid copyright issues.

---

## Source Documents (Cross-Referenced)

Three primary research documents inform this project, produced by Amy, Kaci, and Nick:

| Document | Key Contribution |
|---|---|
| `Tech_Comparison_Timeline_Data` (spreadsheet) | Defines the core data schema: NAME, DEV. START, DEPLOYMENT, DETAILS, STATUS, SOURCE(s). Contains seed data for US systems plus a rich procurement contracts index and sources list. |
| `AI___Military_Brainstorming.docx` | Provides detailed profiles for US systems (Maven Smart System, GenAI.mil, Northrop MantaRay). Identifies key scraping sources. |
| `AI_Arms_Race_Pitch.pptx` | Defines the product vision: interactive timeline with category filters (unmanned vehicles, C2, ISR, logistics, cyber), adoption profiles, and analysis of adoption velocity. Scoping 2016–2026. Identifies SAM.gov as primary data source. |

---

## Goals

1. Launch a working MVP within **1–2 weeks**
2. Populate a PostgreSQL database with the seed data from the team's research (US systems + procurement contracts)
3. Build a public-facing **Next.js / React** timeline website styled after SCSP Space Race
4. Build an **admin dashboard** for a small team (2–5 people) to review, approve, and edit scraped entries
5. Set up automated **web scraping + API ingestion** pipelines targeting official `.mil`/`.gov` sources (SAM.gov, USAspending.gov, DVIDS, Congress.gov, service news feeds)
6. Track **adoption velocity** — how the speed of US military AI adoption has changed over the 2016–2026 window

> **Stretch Goal (out of scope for MVP):** US vs. China comparison. The schema will include a `country` field stubbed in so this can be added later without a migration, but no China data, scrapers, or UI will be built now.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router) + React + Tailwind CSS |
| Database | PostgreSQL (via Prisma ORM) |
| Backend/API | Next.js API routes (serverless) |
| Scraping | Python 3 (`urllib` + `feedparser`); official `.mil`/`.gov` + public-domain DoD APIs/RSS only |
| Auth (admin) | NextAuth.js — single shared credential (env-based) |
| Hosting | **Vercel + Neon Postgres** — live at https://scsp-timeline.vercel.app (see `DEPLOY_VERCEL.md`). Docker Compose self-host also works (`DEPLOY.md`) but is no longer the deployment. |
| Data ingestion | GitHub Actions cron (daily) → token-protected `/api/ingest` |

---

## Repository Structure (Target)

```
/
├── CLAUDE.md                        ← this file
├── app/                             ← Next.js App Router
│   ├── page.tsx                     ← Homepage (featured program tracks + velocity)
│   ├── timeline/                    ← Full timeline with filters
│   ├── system/[id]/                 ← Individual event profile page
│   ├── program/[id]/                ← Program lifecycle profile (all stages)
│   ├── admin/
│   │   ├── page.tsx                 ← Pending review queue + merge-by-program
│   │   └── [id]/edit/page.tsx       ← Edit individual entry
│   └── api/
│       ├── milestones/route.ts      ← CRUD API
│       ├── milestones/merge/route.ts ← group events into a program (admin)
│       ├── programs/route.ts        ← list/create programs; [id] = program + events
│       └── ingest/route.ts          ← Scraper ingest (upserts programs, token-gated)
├── components/
│   ├── Timeline.tsx                 ← Core timeline visualization
│   ├── MilestoneCard.tsx            ← Individual event card
│   ├── FilterBar.tsx                ← Category/date filters
│   └── AdoptionVelocityChart.tsx    ← Milestones-per-year trend chart
├── lib/
│   ├── db.ts                        ← Prisma client
│   ├── auth.ts                      ← NextAuth config
│   ├── ingest.ts                    ← scraped-payload normalization + dedup hashing
│   ├── registry.ts                  ← TS view of scrapers/programs.json (matchProgram)
│   └── verify.ts                    ← ingest verification: relevance + auto-approval gate
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                      ← Seed from team's research data
├── scrapers/                        ← .mil/.gov-only ingestion roster
│   ├── README.md
│   ├── backfill.py                  ← runs the whole roster in one pass
│   ├── sam_gov.py                   ← SAM.gov solicitations + awards (chunked ≤1yr)
│   ├── usaspending_gov.py           ← USAspending.gov DoD awards (no key, historical)
│   ├── dvids_gov.py                 ← DVIDS DoD news / press releases (historical)
│   ├── congress_gov.py              ← Congress.gov AI legislation
│   ├── sbir_gov.py                  ← SBIR/STTR DoD AI awards
│   ├── af_mil.py / army_mil.py / navy_mil.py / spaceforce_mil.py
│   ├── darpa_mil.py / defense_gov.py / gao_gov.py   ← per-agency RSS
│   ├── rss.py                       ← shared RSS relevance + category/event inference
│   └── utils.py                     ← dedup, dates, program_slug, POST to API
├── scripts/
│   └── seed_db.ts
├── .github/workflows/
│   └── scrape.yml                   ← Daily scheduled scraping
└── .env.example
```

---

## Database Schema (PostgreSQL / Prisma)

Derived from the team's spreadsheet schema (`NAME, DEV. START, DEPLOYMENT, DETAILS, STATUS, SOURCE(s)`) plus the procurement contracts index:

A `Program` groups the lifecycle **events** of a single system/initiative. A
`Milestone` is one dated event in that lifecycle (tagged with an `EventType`),
optionally linked to a `Program` via `programId`. Scrapers assign a stable
`slug` for cross-source auto-linking; unmatched events land ungrouped and an
admin merges them. `programId = null` means a standalone event.

```prisma
model Program {
  id           String        @id @default(cuid())
  slug         String        @unique                   // entity-resolution key
  name         String
  description  String        @default("")
  actor        String
  country      Country       @default(US)
  category     Category
  subcategory  String?
  systemStatus SystemStatus?                            // derived from furthest-along event
  significance Int           @default(1)
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  events       Milestone[]
}

model Milestone {
  id               String        @id @default(cuid())
  name             String                              // System/initiative name
  description      String                              // Full details
  actor            String                              // Developing org (e.g. "Palantir", "DARPA")
  country          Country       @default(US)          // Stubbed for future expansion
  category         Category
  subcategory      String?                             // e.g. "Counter-UAS", "C2", "Unmanned Maritime"

  // Lifecycle grouping — a Milestone is one dated event in a Program's lifecycle
  programId        String?                             // null = standalone event
  program          Program?      @relation(fields: [programId], references: [id], onDelete: SetNull)
  eventType        EventType?                           // which lifecycle stage this is
  eventDate        DateTime?                            // stage-agnostic date of this event

  // Key dates (all nullable — some are unknown per the research data)
  devStartDate     DateTime?
  procurementDate  DateTime?
  testDate         DateTime?
  testLocation     String?
  fieldingDate     DateTime?
  deploymentDate   DateTime?

  // Status tracking
  entryStatus      EntryStatus   @default(PENDING)    // Admin review gate
  systemStatus     SystemStatus?                      // e.g. Fielded, Testing, Development

  // Source info
  sourceUrl        String?
  sourceName       String?
  additionalSources String[]                          // Multiple sources per the research

  // Procurement-specific fields
  contractNumber   String?
  contractValue    Float?                             // In raw USD for sortability
  issuingAgency    String?
  awardedTo        String?

  // Significance
  significance     Int           @default(1)          // 1–5

  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt
  tags             Tag[]
}

enum Category {
  UNMANNED_SYSTEMS        // UUVs, USVs, drones, robot platforms
  COMMAND_CONTROL         // C2, C4ISR, battle management
  ISR                     // Intelligence, Surveillance, Reconnaissance
  LOGISTICS_SUSTAINMENT   // Supply chain, maintenance prediction
  CYBER                   // Cybersecurity, EW, signals
  TARGETING               // Targeting systems, sensor-to-shooter
  POLICY_DIRECTIVE        // Executive orders, NSPMs, DoD directives
  TRAINING_SIMULATION     // Wargaming, TTX, synthetic data
  MEDICAL                 // Battlefield medical AI
  SPACE                   // Space domain awareness
  RESEARCH_DEVELOPMENT    // DARPA programs, university research
  OTHER                   // Catch-all: matched no mission-domain keyword (general AI/ML R&D, cross-domain vehicles)
}

// NOTE: there is no PROCUREMENT_CONTRACT category. A contract is a funding
// instrument, not a mission domain — "it's a contract" is carried by
// eventType=AWARD + the contract fields (contractNumber/contractValue/awardedTo),
// while `category` records the substantive domain (TARGETING, ISR, …), inferred
// from the item text and falling back to OTHER. (Historical note: an earlier
// build had a PROCUREMENT_CONTRACT category; it was removed and its rows
// reassigned to inferred domains — see prisma/migrations/*_remove_procurement_category.)

enum Country {
  US          // Active for MVP
  CHINA       // Stubbed — no data populated until stretch goal
  NATO
  OTHER
}

enum EntryStatus {
  PENDING     // Scraped or submitted, awaiting admin review
  APPROVED    // Live on public site
  REJECTED    // Dismissed
}

enum SystemStatus {
  DEVELOPMENT
  TESTING
  FIELDED
  CANCELLED
  UNKNOWN
}

// A single stage in a Program's lifecycle, ordered roughly by maturity so the
// server can derive a Program's systemStatus from its furthest-along event.
enum EventType {
  RD_START        // R&D / dev start (DARPA program, SBIR award)
  SOLICITATION    // RFI / solicitation posted
  AWARD           // contract awarded
  TEST            // test / evaluation event
  FIELDING        // initial fielding
  DEPLOYMENT      // full operational deployment
  POLICY          // policy / directive / oversight
  OTHER           // uncategorized lifecycle event
}

model Tag {
  id          String      @id @default(cuid())
  name        String      @unique
  milestones  Milestone[]
}
```

---

## Seed Data (From Team Research)

The Database Agent must seed the following verified US entries from the team's documents. All entries are real and sourced — do not fabricate data.

### US Systems

| Name | Actor | Category | Dev Start | Deployment | System Status |
|---|---|---|---|---|---|
| Maven Smart System | Palantir / DoD | TARGETING | Apr 2017 | Dec 2025 / May 2026 | FIELDED |
| GenAI.mil | USAF 732nd AMS | TRAINING_SIMULATION | Dec 2025 | Jun 2026 | FIELDED |
| Northrop Grumman MantaRay XL-UUV | Northrop Grumman / DARPA | UNMANNED_SYSTEMS | 2020 | Feb–Mar 2024 (test) | TESTING |

> Each of these three is seeded as a **`Program`** whose dates become lifecycle
> **events** (e.g. Maven → `RD_START` 2017 → `AWARD` 2024 → `TEST` 2025 →
> `DEPLOYMENT` 2026). The Maven ATR contract from the procurement table below is
> folded in as Maven's `AWARD` event rather than seeded as a standalone contract.

### US Procurement Contracts (from Verified Procurement Index in spreadsheet)

Seed all contracts from the `Procurement Contracts` sheet. Key entries include:

| Contract # | Agency | Awardee | Value | Application |
|---|---|---|---|---|
| FA875023S7006 | AFRL | Palantir / Booz Allen | $99M | Distributed C2 |
| HQ003423D0019 | WHS/DISA | AWS, Google, Microsoft, Oracle | $9B | JWCC Multi-Cloud |
| N00014-24-C-XXXX | ONR/NGA/CDAO | Palantir | $1.4B | Project Maven ATR |
| FA8650-22-F-2611 | AFRL | Mile Two LLC | $14.78M | Human-UAS Swarming |
| W519TC-23-S-CTSM | CDAO | Scale AI, Anduril, C3 AI | Multi-Award | Tradewinds Marketplace |
| + all remaining contracts from the sheet | | | | |

### US Policy Directives (from sources sheet)

Seed key policy milestones including:
- Third Offset Strategy (~2014)
- Establishment of JAIC
- Establishment of CDAO
- DoD Ethical Principles for AI
- Executive Order 14110 on Safe and Trustworthy AI
- Task Force Lima establishment
- NSPM-11 (Jun 2026)
- National Defense Strategy AI guidance entries

---

## Agent Roster & Responsibilities

This project uses an **orchestrator + subagent** pattern. The orchestrator reads this file and delegates tasks to specialized subagents.

---

### Orchestrator Agent

**Role:** Project coordinator. Reads CLAUDE.md, breaks work into phases, assigns subagent tasks, validates outputs before marking steps complete.

**Instructions:**
- Present a plan for approval before large or destructive changes (migrations, deploys, bulk deletes)
- Track completed phases with a checklist in responses
- Surface all blockers and open decisions to the human immediately
- Reference the seed data tables above when validating Database Agent output
- Do not build, reference, or stub any China-facing features, scrapers, or UI elements
- Ingest only from `.mil`/`.gov` + public-domain DoD sources (no commercial news)

---

### Subagent 1 — Database Agent

**Role:** Design and initialize the PostgreSQL database.

**Tasks:**
1. Generate `prisma/schema.prisma` from the schema above (all models, enums, relations)
2. Generate `prisma/migrations/` for the initial migration
3. Write `prisma/seed.ts` with all entries from the **Seed Data** section above:
   - All 3 US systems (Maven, GenAI.mil, MantaRay)
   - All procurement contracts from the Verified Procurement Index
   - Key policy directives from the sources sheet
   - Populate `additionalSources[]` with multiple source URLs where the research provides them
   - All entries use `country: Country.US`
4. Write `scripts/seed_db.ts` runner
5. Output a verification query confirming row counts by category

**Constraints:**
- All entries must use real dates and sources from the team's research — no fabricated data
- `systemStatus` must reflect the team's research (e.g. "Fielded" → `FIELDED`)
- `contractValue` stored in raw USD (not millions) for sortability
- Do not seed any non-US entries

---

### Subagent 2 — Scraper Agent

**Role:** Ingest US military AI lifecycle **events** from official `.mil`/`.gov`
and public-domain DoD sources. Each scraper emits normalized events (with an
`eventType`, `eventDate`, and — where confident — a `programSlug`) that POST to
`/api/ingest`. Full details in [`scrapers/README.md`](./scrapers/README.md).

**Sources (all `.mil`/`.gov` or public-domain DoD — no commercial news):**

| Source | Reach | Key |
|---|---|---|
| SAM.gov (solicitations + awards) | recent window, quota-capped (`--recent-days`/`--max-requests`; chunked ≤1yr/call) | free (low daily quota) |
| USAspending.gov (DoD contract awards) | 2016→present | none |
| DVIDS (DoD news / press releases) | 2016→present (historical) | free public |
| Congress.gov (AI legislation) | recent (title search) | free |
| SBIR.gov (DoD SBIR/STTR awards) | historical | none |
| af / army / navy / spaceforce / darpa / defense / gao (RSS) | recent (~1yr at `max=500`) | none |

**Design:**
- **Lifecycle grouping** — SAM.gov/USAspending/SBIR carry a stable key and
  auto-link into a `Program`; RSS/DVIDS items are emitted ungrouped (a headline
  is an unreliable key) for admin merge.
- **`scrapers/rss.py`** — shared feed machinery: relevance filter, category +
  event-type inference; enforces `.mil`/`.gov` hosts.
- **`scrapers/utils.py`** — dates (incl. ISO + partial), `program_slug`,
  within-run dedup, ingest POST. Sets a real `User-Agent` (default
  `Python-urllib` gets 403'd by `.gov` WAFs).
- **`scrapers/backfill.py`** — runs the whole roster in one pass; used by the
  daily GitHub Action and for the one-time historical backfill.

**Constraints:**
- Scrapers output `entryStatus: PENDING`; the server-side verifier (`lib/verify.ts`)
  then sets the final status on ingest (may auto-approve high-confidence tracked
  programs or auto-reject clearly-irrelevant entries) — see the ingest task below
- Every entry must include `sourceUrl` and `sourceName`
- Paginate/handle rate limits; server upserts by an event dedup hash
- US sources only; `.mil`/`.gov` + public-domain DoD only (copyright)

---

### Subagent 3 — Frontend Agent

**Role:** Build the public-facing Next.js timeline website.

**Design Reference:** https://www.scsp.ai/space-race/
- Dark background, bold typography, high information density
- Timeline is the hero — prominent, scrollable, filterable
- Strong visual hierarchy between categories

**Key Features (from pitch deck):**

1. **Interactive Timeline** (`components/Timeline.tsx`):
   - Vertical scrollable timeline grouped by year (2016–2026)
   - Color-coded by `Category` enum (palette: [docs/CATEGORY_COLORS.md](./docs/CATEGORY_COLORS.md); source of truth `lib/categories.ts`)
   - **Program lifecycle tracks** (`components/ProgramCard.tsx`): events belonging
     to a program render as one track (request → award → test → deployment),
     anchored at the program's earliest event; standalone events render as cards
   - Click a track → `/program/[id]` profile; click an event → `/system/[id]`
   - Visual density indicator showing clustering by year

2. **Category Filters** (`components/FilterBar.tsx`) — from pitch deck:
   - Unmanned Vehicles
   - Command & Control (C2)
   - ISR
   - Logistics
   - Cyber
   - Targeting
   - Policy / Directive
   - Training / Simulation
   - Other (catch-all; contracts are categorized by mission domain, not as a "procurement" bucket)
   - Date range slider (2016–2026)

3. **Profile Pages** — "adoption profiles" per pitch deck:
   - **Program profile** (`app/program/[id]/page.tsx`): the full lifecycle track —
     every stage in order (with type, date, contract value), derived status, and
     aggregated sources across all events.
   - **Event profile** (`app/system/[id]/page.tsx`): a single event's detail; if
     it belongs to a program, a banner links to the program lifecycle.
   - All source links, contract value, test location where available.

4. **Adoption Velocity Chart** (`components/AdoptionVelocityChart.tsx`):
   - Bar or line chart: milestones per year 2016–2026
   - Shows the acceleration of US military AI adoption over time
   - Filterable by category

5. **Homepage** (`app/page.tsx`):
   - Hero: "US Military AI Adoption Timeline 2016–2026"
   - Featured/significant milestones
   - Adoption velocity chart above the fold
   - Call to explore full timeline

**Constraints:**
- Tailwind CSS only
- TypeScript throughout
- All data fetched from `/api/milestones` — no direct DB calls from components
- Mobile-responsive, desktop-primary
- No country filter or comparison UI in MVP

---

### Subagent 4 — Admin Dashboard Agent

**Role:** Build the internal content management interface for the team (Amy, Kaci, Nick + others).

**Tasks:**
1. **`app/admin/page.tsx`** — Pending review queue (`components/admin/AdminQueue.tsx`):
   - Table: name, program, event type, category, actor, event date, source, scraped date
   - Bulk approve / bulk reject; individual approve / edit / reject
   - **Merge selected events into a program** (`components/admin/MergeControl.tsx`):
     pick an existing program or create a new one → builds a lifecycle
2. **`app/admin/[id]/edit/page.tsx`** — Full edit form:
   - All fields editable incl. all dates, **event type + event date**, and program
   - `additionalSources[]` as dynamic add/remove list
   - Save → `entryStatus=APPROVED`; Reject → `REJECTED` with optional note
3. **`lib/auth.ts`** — NextAuth credentials auth:
   - **Single shared credential** (env `ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH`), not per-user
   - Middleware protecting all `/admin/*` routes
4. **REST API:**
   - `GET /api/milestones` → approved events (public) / `?status=PENDING` (admin), includes `program`
   - `POST /api/milestones` (admin) · `PATCH /api/milestones/[id]` (admin; incl. program/eventType/eventDate)
   - `POST /api/milestones/merge` (admin) → assign events to a program, recompute status
   - `GET /api/programs` (list) · `GET /api/programs/[id]` (program + its events)
5. **`app/api/ingest/route.ts`** — Scraper ingest:
   - Token-gated (`INGEST_TOKEN`); upserts the `Program` by slug and links the event
   - Event dedup hash (`sha256(slug|eventType|eventDate|sourceUrl)`)
   - **Verification gate (`lib/verify.ts`)** runs on each *new* event to set
     `entryStatus` (instead of a blanket `PENDING`), cutting review load. It
     handles two entry shapes differently:
     - **Registry match (any source) → `APPROVED`:** the item names a curated
       program (`scrapers/programs.json`). A hand-maintained registry hit is
       high-confidence on its own — fast path, no LLM.
     - **Non-milestone framing gate (overrides every auto-approve):** an item
       whose *title* reads as a visit, media package (VIDEO/AUDIO/podcast),
       ceremony (ribbon-cutting, change of command, awards, hall of fame), tour,
       or competition result is **not** an adoption milestone — the timeline
       tracks deployment/testing/award events — so it never auto-approves, not
       even on a registry match (which previously waved a celebrity "visit"
       through on a coincidental body-text program mention). Such items drop to
       `PENDING` (`isNonMilestoneFraming` in `lib/verify.ts`; withholds the
       registry and news auto-approve paths). Descriptions are also stripped of
       HTML/links and decoded (`lib/clean.ts`) on ingest.
     - **Procurement awards (SAM.gov / USAspending)** stay on the cheap keyword
       path: AI/autonomy keyword relevance → `PENDING`; otherwise the LLM
       decides `PENDING` vs `REJECTED`. Contracts never LLM-auto-approve (they
       auto-approve only via the registry).
     - **News (DVIDS / service RSS) → LLM 3-way triage:** the keyword filter
       can't tell an AI-driven exercise from a workshop that merely discusses
       AI (the word "challenge" appears in both a real exercise and a prize
       competition), so news goes to Claude (`ANTHROPIC_API_KEY`) for a
       curated-rubric decision:
       - **`approve` → `APPROVED`:** AI/autonomy actually applied, demoed, used,
         deployed, fielded, integrated, or automating a real task/mission
         (incl. within an exercise/experiment), or concrete activity on a
         specific named AI/autonomous system.
       - **`review` → `PENDING`:** AI involved only peripherally (novelty use)
         or an indirect investment in an external/academic program.
       - **`reject` → `REJECTED`:** competitions/challenges/hackathons/prizes/
         proposal deadlines, summits/workshops/offsites/"innovation days" that
         only discuss or promote AI, items naming no specific technology or
         application, non-defense uses, or items not actually about AI/autonomy.
       The rubric is calibrated against human-labeled DVIDS/.mil examples.
     - **No-key fallback (this deployment has no `ANTHROPIC_API_KEY`):** news
       runs a **deterministic** version of the same triage — high-precision
       keyword lists (`APPLY_SIGNALS` / `REJECT_SIGNALS` in `lib/verify.ts`)
       drawn from the same labeled examples. It auto-approves clear "AI applied"
       stories, auto-rejects clear talk-only/competition/non-defense ones, and
       sends anything ambiguous (incl. mixed signals) to `PENDING`. Tuned so
       nothing GOOD is auto-rejected and nothing BAD is auto-approved on the
       label set; it is coarser than the LLM (more items land in `PENDING`).
       Setting `ANTHROPIC_API_KEY` upgrades news triage to the LLM automatically.
     - Each verdict's rationale is stored on `Milestone.verifyReason` and shown
       in the admin queue. Re-ingesting an existing event **preserves** its
       current `entryStatus` (an admin's approve/reject is never re-flipped).
       Response returns a `verdicts` tally; rejected entries stay in the DB
       (admin `?status=REJECTED`).

**Constraints:**
- Admin routes 401 if unauthenticated; ingest 401 without the token
- Single shared admin login — no public registration (per-user is a future upgrade)
- Show scraper source provenance clearly so reviewers can judge quality

---

### Subagent 5 — DevOps / Config Agent

**Role:** Project scaffold, environment config, and deployment.

**Tasks:**
1. `.env.example` (local) + `.env.production.example` (deploy): `DATABASE_URL`,
   `NEXTAUTH_SECRET`/`NEXTAUTH_URL`, `ADMIN_EMAIL`/`ADMIN_PASSWORD_HASH`,
   `INGEST_TOKEN`, and optional scraper keys (`SAM_GOV_API_KEY`,
   `CONGRESS_API_KEY`, `DVIDS_API_KEY`).
2. `docker-compose.yml` (local Postgres) + `docker-compose.prod.yml` (app +
   Postgres; entrypoint runs `prisma migrate deploy`).
3. `.github/workflows/scrape.yml` — daily cron (06:00 UTC) runs
   `scrapers/backfill.py` → token-gated `/api/ingest`. Secrets: `INGEST_URL`,
   `INGEST_TOKEN`, + optional API keys. Runs from the **default branch**.
4. Deployment: **Docker self-host** — see `DEPLOY.md` (runbook) and
   `DEPLOY_WITH_CLAUDE.md` (paste-able Claude deploy prompt).
5. `README.md`: local setup, running scrapers, the shared admin login, and the
   `.mil`/`.gov` data-source list.

**Gotcha:** in the docker-compose `env_file`, escape every `$` in
`ADMIN_PASSWORD_HASH` as `$$` — Compose interpolates env_file values, so an
unescaped bcrypt hash is mangled and login silently fails.

---

## Execution Phases

All phases below are complete; the checklist is retained as build history.

```
Phase 1 — Foundation                                                    ✅ Done
  [x] Project scaffold, .env, docker-compose, README
  [x] Prisma schema + initial migration

Phase 2 — Seed Data                                                     ✅ Done
  [x] Seed US systems (as program lifecycles), contracts, policy directives
  [x] Verification query (row counts by category)

Phase 3 — Scrapers (.mil/.gov only)                                     ✅ Done
  [x] SAM.gov (chunked ≤1yr) + USAspending + DVIDS + Congress + SBIR
  [x] Per-agency RSS (af/army/navy/spaceforce/darpa/defense/gao) + rss.py
  [x] utils.py (dedup, dates, program_slug, UA, ingest POST) + backfill.py

Phase 4 — Frontend                                                      ✅ Done
  [x] Homepage (featured program tracks) + adoption velocity chart
  [x] Timeline: year grouping, color coding, program lifecycle tracks
  [x] Filter bar (all categories) + date range
  [x] Program profile + event profile pages

Phase 5 — Admin                                                         ✅ Done
  [x] Review queue + bulk actions + merge-by-program
  [x] Edit form (incl. event type/date/program) + auth middleware
  [x] API routes (milestones, programs, merge, ingest)

Phase 6 — Integration & Deploy                                          ✅ Done
  [x] GitHub Actions scrape schedule (backfill.py → token-gated ingest)
  [x] Docker self-host config (docker-compose.prod.yml, DEPLOY.md)
  [x] End-to-end smoke tests (validated against a live prod stack)

Post-MVP                                                                ✅ Done
  [x] Program-lifecycle model (Program + EventType + merge tooling)
  [x] Historical backfill to 2016 (SAM.gov, USAspending, DVIDS)
```

---

## Design Principles

- **Policy-first clarity:** Every milestone must be understandable to a non-technical Washington policymaker. Jargon explained or avoided.
- **Source integrity:** Every entry needs a `sourceUrl`. No unsourced entries go live. Multiple sources preferred (as in the team's research).
- **Adoption velocity as a narrative:** The site should convey *how fast* US military AI adoption is accelerating — the core analytical insight per the pitch deck.
- **Admin trust gate (auto-approve by known-program match):** Scraped entries are
  reviewed before going public, *except* the high-confidence set the ingest
  verifier (`lib/verify.ts`) auto-approves — entries that name a **curated program**
  (`scrapers/programs.json`). Auto-approval is driven by relevance to a known
  project name, **not** by contract dollar value. Everything else still requires
  human review (news via the LLM 3-way triage — or a deterministic keyword
  fallback when no `ANTHROPIC_API_KEY` is set, as on this deployment; procurement
  via the keyword path); clearly-irrelevant entries are auto-rejected (kept in
  the DB, not deleted).
- **Significance = known-project relevance, not money:** A milestone's
  `significance` reflects whether it maps to a tracked program (a named,
  known project), **not** the size of a contract. A $9B award that names no known
  program is not automatically "significant"; a contract tied to Maven or
  Replicator is. Scrapers score significance by registry match, not dollar value.
- **Speed over perfection:** MVP in 1–2 weeks. Ship working, iterate later.
- **Future-proof schema:** The `country` field is stubbed in the schema to support future expansion without a migration — but no China-facing features are built now.

---

## Out of Scope for MVP

- **China data, scrapers, or comparison UI** (stretch goal — schema supports it when ready)
- User accounts / public login
- PDF report export
- Email notifications
- Mobile app
- Embeddings / semantic search
- Comments or community contributions

---

## Key Decisions

1. **Project name / branding** — ⏳ still open, needed before public launch
2. **Hosting** — ✅ resolved: Vercel + Neon Postgres (`DEPLOY_VERCEL.md`); Docker self-host remains as a fallback (`DEPLOY.md`)
3. **Admin accounts** — ✅ resolved: one shared credential for the team (per-user auth is a future upgrade)
4. **Significance scoring** — ✅ resolved: **by known-program match, not money** — 4 if a scraped entry maps to a curated program (`scrapers/programs.json`), else 2; manual for curated/reviewed entries
5. **Classification scope** — unclassified only; `.mil`/`.gov` + public-domain DoD sources — no classified sources in the pipeline
6. **Deployment public URL** — ✅ resolved: https://scsp-timeline.vercel.app (daily scrape POSTs to its token-gated `/api/ingest`)
7. **News triage without an API key** — the prod deployment has no `ANTHROPIC_API_KEY`, so the daily automated scrape triages news with the deterministic keyword fallback. For higher-quality triage we **periodically rerun the scraper locally with Claude Code as the triage engine** (dry-run scrape → Claude classifies news via the `lib/verify.ts` 3-bucket rubric → ingest to Neon). Optionally set `ANTHROPIC_API_KEY` on Vercel to upgrade the automated path to the LLM.

---

## References

- Design: https://www.scsp.ai/space-race/
- SAM.gov API: https://open.gsa.gov/api/get-opportunities-public-api/
- USAspending API: https://api.usaspending.gov/
- DVIDS API: https://api.dvidshub.net/
- Congress.gov API: https://api.congress.gov/
- Next.js App Router: https://nextjs.org/docs · Prisma: https://www.prisma.io/docs · NextAuth.js: https://next-auth.js.org
- Runbooks: [DEPLOY.md](./DEPLOY.md) · [DEPLOY_WITH_CLAUDE.md](./DEPLOY_WITH_CLAUDE.md) · [scrapers/README.md](./scrapers/README.md)
- Category color palette: [docs/CATEGORY_COLORS.md](./docs/CATEGORY_COLORS.md) (source of truth `lib/categories.ts`)