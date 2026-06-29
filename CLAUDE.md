# CLAUDE.md — US Military AI Adoption Timeline & Analysis Platform

## Project Overview

A **US military AI adoption tracker** for Washington policymakers and Silicon Valley developers. The site surfaces military AI milestones — procurement contracts, fielded systems, policy directives, and technology developments — with filtering, comparison, and trend analysis. Scope: 2016–2026, US-focused.

Visual design reference: [SCSP Space Race](https://www.scsp.ai/space-race/)

**Mode:** Plan mode — all agents operate in plan/draft mode only. No code is executed, no files are written, no database mutations occur unless explicitly approved.

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
5. Set up automated **web scraping + API ingestion** pipelines targeting SAM.gov, defense news sources, and official military sites
6. Track **adoption velocity** — how the speed of US military AI adoption has changed over the 2016–2026 window

> **Stretch Goal (out of scope for MVP):** US vs. China comparison. The schema will include a `country` field stubbed in so this can be added later without a migration, but no China data, scrapers, or UI will be built now.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router) + React + Tailwind CSS |
| Database | PostgreSQL (via Prisma ORM) |
| Backend/API | Next.js API routes (serverless) |
| Scraping | Python (BeautifulSoup / Playwright) |
| Auth (admin) | NextAuth.js (credentials-based for MVP) |
| Hosting | Vercel (frontend) + Railway or Supabase (Postgres) — recommended for fast MVP |
| Data ingestion | GitHub Actions cron for scheduled scraping |

---

## Repository Structure (Target)

```
/
├── CLAUDE.md                        ← this file
├── app/                             ← Next.js App Router
│   ├── page.tsx                     ← Public timeline homepage
│   ├── timeline/                    ← Full timeline with filters
│   ├── system/[id]/                 ← Individual system/milestone profile page
│   ├── admin/
│   │   ├── page.tsx                 ← Pending review queue
│   │   └── [id]/edit/page.tsx       ← Edit individual entry
│   └── api/
│       ├── milestones/route.ts      ← CRUD API
│       └── ingest/route.ts          ← Scraper webhook receiver
├── components/
│   ├── Timeline.tsx                 ← Core timeline visualization
│   ├── MilestoneCard.tsx            ← Individual event card
│   ├── FilterBar.tsx                ← Category/date filters
│   └── AdoptionVelocityChart.tsx    ← Milestones-per-year trend chart
├── lib/
│   ├── db.ts                        ← Prisma client
│   └── auth.ts                      ← NextAuth config
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                      ← Seed from team's research data
├── scrapers/
│   ├── README.md
│   ├── sam_gov.py                   ← SAM.gov procurement scraper
│   ├── news_rss.py                  ← Defense news RSS scraper
│   ├── af_mil.py                    ← af.mil official news scraper
│   └── utils.py                     ← Shared dedup, rate limiting, POST to API
├── scripts/
│   └── seed_db.ts
├── .github/workflows/
│   └── scrape.yml                   ← Daily scheduled scraping
└── .env.example
```

---

## Database Schema (PostgreSQL / Prisma)

Derived from the team's spreadsheet schema (`NAME, DEV. START, DEPLOYMENT, DETAILS, STATUS, SOURCE(s)`) plus the procurement contracts index:

```prisma
model Milestone {
  id               String        @id @default(cuid())
  name             String                              // System/initiative name
  description      String                              // Full details
  actor            String                              // Developing org (e.g. "Palantir", "DARPA")
  country          Country       @default(US)          // Stubbed for future expansion
  category         Category
  subcategory      String?                             // e.g. "Counter-UAS", "C2", "Unmanned Maritime"

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
  PROCUREMENT_CONTRACT    // SAM.gov contracts, OTAs
  TRAINING_SIMULATION     // Wargaming, TTX, synthetic data
  MEDICAL                 // Battlefield medical AI
  SPACE                   // Space domain awareness
  RESEARCH_DEVELOPMENT    // DARPA programs, university research
}

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
- Always operate in **plan mode** — present plans for approval before any execution
- Track completed phases with a checklist in responses
- Never invoke a subagent for a later phase until the prior phase is approved
- Surface all blockers and open decisions to the human immediately
- Reference the seed data tables above when validating Database Agent output
- Do not build, reference, or stub any China-facing features, scrapers, or UI elements

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

**Role:** Build automated data ingestion pipelines targeting US defense sources.

**Sources (from pitch deck + brainstorming doc):**
- SAM.gov — procurement contracts and RFIs (primary source per pitch deck)
- af.mil/News — official Air Force AI announcements
- Breaking Defense, DefenseScoop, C4ISRNET — defense news RSS
- DARPA.mil — program announcements
- Congress.gov — NDAA provisions, hearings

**Tasks:**
1. **`scrapers/sam_gov.py`** — SAM.gov procurement scraper:
   - Search keywords: "artificial intelligence", "machine learning", "autonomous", "unmanned"
   - Date range: 2016–present
   - Extract: notice ID, agency, awardee, value, description
   - Output: normalized JSON matching Milestone schema, `category=PROCUREMENT_CONTRACT`, `entryStatus=PENDING`
2. **`scrapers/news_rss.py`** — Defense news RSS scraper:
   - Sources: Breaking Defense, DefenseScoop, C4ISRNET, af.mil/News, DARPA news
   - Output: normalized JSON, category inferred from content, `entryStatus=PENDING`
3. **`scrapers/af_mil.py`** — af.mil official announcements scraper
4. **`scrapers/utils.py`** — shared utilities:
   - Deduplication by hash(name + devStartDate)
   - Rate limiting and polite crawl delays
   - Output writer that POSTs to `/api/ingest`
   - Date parser that handles partial dates (year only, year+month)

**Constraints:**
- All scrapers output `entryStatus: "PENDING"` — nothing auto-approves
- Every entry must include `sourceUrl` and `sourceName`
- SAM.gov scraper must handle pagination
- US sources only — no international scraping targets in MVP

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
   - Color-coded by `Category` enum
   - Click to expand → system detail / "adoption profile"
   - Visual density indicator showing milestone clustering by year

2. **Category Filters** (`components/FilterBar.tsx`) — from pitch deck:
   - Unmanned Vehicles
   - Command & Control (C2)
   - ISR
   - Logistics
   - Cyber
   - Targeting
   - Policy / Directive
   - Procurement Contract
   - Training / Simulation
   - Date range slider (2016–2026)

3. **System Profile Pages** (`app/system/[id]/page.tsx`) — "adoption profiles" per pitch deck:
   - Full description, all dates (dev start → procurement → test → fielding → deployment)
   - All source links
   - Contract value (if applicable)
   - Related systems/tags
   - Test location (if available)

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
1. **`app/admin/page.tsx`** — Pending review queue:
   - Table: name, category, actor, dev start, deployment, source, scraped date
   - Bulk approve / bulk reject
   - Individual approve / edit / reject buttons
   - Filter by category
2. **`app/admin/[id]/edit/page.tsx`** — Full edit form:
   - All milestone fields editable including all date fields
   - `additionalSources[]` as dynamic add/remove list
   - Save → sets `entryStatus=APPROVED`
   - Reject → sets `entryStatus=REJECTED` with optional note
3. **`lib/auth.ts`** — NextAuth credentials auth:
   - Email + password for MVP
   - Middleware protecting all `/admin/*` routes
4. **`app/api/milestones/route.ts`** — REST API:
   - `GET /api/milestones` → approved milestones (public, with pagination)
   - `GET /api/milestones?status=PENDING` → admin only
   - `POST /api/milestones` → create / ingest
   - `PATCH /api/milestones/[id]` → update (admin only)
5. **`app/api/ingest/route.ts`** — Scraper ingest endpoint:
   - Accepts POST from scrapers
   - Runs deduplication before inserting
   - Sets `entryStatus=PENDING` always

**Constraints:**
- Admin routes 401 if unauthenticated
- No public registration — seed admin accounts manually for the team
- Show scraper source provenance clearly so reviewers can judge quality

---

### Subagent 5 — DevOps / Config Agent

**Role:** Project scaffold, environment config, and deployment.

**Tasks:**
1. Generate `.env.example`:
   ```
   DATABASE_URL=
   NEXTAUTH_SECRET=
   NEXTAUTH_URL=
   ADMIN_EMAIL=
   ADMIN_PASSWORD_HASH=
   ```
2. Write `docker-compose.yml` for local Postgres development
3. Write `.github/workflows/scrape.yml` — daily scraping cron (6am UTC):
   - Runs `sam_gov.py`, `news_rss.py`, `af_mil.py`
   - POSTs results to `/api/ingest`
4. Write deployment notes: Vercel (frontend) + Railway (Postgres)
5. Write `README.md` covering:
   - Local setup and dev environment
   - How to run scrapers manually
   - How to add admin users
   - Data sources list (SAM.gov, af.mil, defense news RSS)

---

## Execution Phases

The orchestrator executes in order, waiting for human approval between phases:

```
Phase 1 — Foundation
  [ ] Subagent 5: Project scaffold, .env, docker-compose, README
  [ ] Subagent 1: Prisma schema + initial migration

Phase 2 — Seed Data
  [ ] Subagent 1: Seed all US entries from team research
       - 3 US systems (Maven, GenAI.mil, MantaRay)
       - Full procurement contracts index
       - Policy directives timeline
  [ ] Subagent 1: Verification query (row counts by category)

Phase 3 — Scrapers
  [ ] Subagent 2: SAM.gov scraper
  [ ] Subagent 2: Defense news RSS scraper
  [ ] Subagent 2: af.mil scraper
  [ ] Subagent 2: utils.py (dedup, rate limiting, ingest POST)

Phase 4 — Frontend
  [ ] Subagent 3: Homepage + adoption velocity chart
  [ ] Subagent 3: Timeline component with year grouping + color coding
  [ ] Subagent 3: Filter bar (all categories from pitch deck)
  [ ] Subagent 3: System profile pages

Phase 5 — Admin
  [ ] Subagent 4: Admin dashboard + pending queue
  [ ] Subagent 4: Edit form + auth middleware
  [ ] Subagent 4: API routes (milestones + ingest)

Phase 6 — Integration & Deploy
  [ ] Subagent 5: GitHub Actions scrape schedule
  [ ] Subagent 5: Vercel + Railway deployment config
  [ ] All agents: End-to-end smoke test plan
```

---

## Design Principles

- **Policy-first clarity:** Every milestone must be understandable to a non-technical Washington policymaker. Jargon explained or avoided.
- **Source integrity:** Every entry needs a `sourceUrl`. No unsourced entries go live. Multiple sources preferred (as in the team's research).
- **Adoption velocity as a narrative:** The site should convey *how fast* US military AI adoption is accelerating — the core analytical insight per the pitch deck.
- **Admin trust gate:** Nothing scraped goes public without human review.
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

## Key Decisions Still Open (Human Must Decide)

1. **Project name / branding** — needed before deploy
2. **Hosting confirmation** — Vercel + Railway recommended
3. **Admin accounts** — who gets access at launch (Amy, Kaci, Nick + others?)
4. **Significance scoring** — manual admin judgment vs. automated heuristic (contract value, etc.)
5. **Classification scope** — confirm site is unclassified only; no classified sources in the pipeline

---

## References

- Design: https://www.scsp.ai/space-race/
- SAM.gov API: https://api.sam.gov/
- Next.js App Router: https://nextjs.org/docs
- Prisma: https://www.prisma.io/docs
- NextAuth.js: https://next-auth.js.org