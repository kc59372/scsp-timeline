/**
 * Ingest normalization + validation.
 *
 * Shared by the /api/ingest route (Phase 3) and reusable by Phase 5 admin
 * tooling. Turns a loosely-typed scraped payload into a validated Prisma
 * Milestone create/update input, and computes the authoritative dedup hash.
 *
 * Design rules (per CLAUDE.md):
 *  - entryStatus is ALWAYS forced to PENDING here — callers cannot auto-approve.
 *  - dedupeHash = sha256(normalizedName + "|" + devStartDateISO) — computed
 *    server-side, never trusted from the client.
 *  - Unknown/absent fields become null; no fabrication.
 */
import { createHash } from "crypto";
import { Prisma, Category, Country, SystemStatus, EventType } from "@prisma/client";

const CATEGORY_VALUES = new Set(Object.values(Category));
const COUNTRY_VALUES = new Set(Object.values(Country));
const SYSTEM_STATUS_VALUES = new Set(Object.values(SystemStatus));
const EVENT_TYPE_VALUES = new Set(Object.values(EventType));

/** Date fields accepted on the wire and mapped 1:1 onto the schema. */
const DATE_FIELDS = [
  "devStartDate",
  "procurementDate",
  "testDate",
  "fieldingDate",
  "deploymentDate",
  "eventDate",
] as const;

/**
 * Lifecycle maturity ranking. A Program's systemStatus is derived from its
 * furthest-along event; higher rank wins. Kept here (pure) so both the ingest
 * route and admin merge tooling agree on the mapping.
 */
const EVENT_STATUS: Record<EventType, { status: SystemStatus; rank: number }> = {
  RD_START: { status: "DEVELOPMENT", rank: 1 },
  SOLICITATION: { status: "DEVELOPMENT", rank: 2 },
  AWARD: { status: "DEVELOPMENT", rank: 3 },
  TEST: { status: "TESTING", rank: 4 },
  FIELDING: { status: "FIELDED", rank: 5 },
  DEPLOYMENT: { status: "FIELDED", rank: 6 },
  POLICY: { status: "UNKNOWN", rank: 0 },
  OTHER: { status: "UNKNOWN", rank: 0 },
};

/** Implied system status + maturity rank for an event type (0 = no signal). */
export function eventStatus(type: EventType): { status: SystemStatus; rank: number } {
  return EVENT_STATUS[type] ?? { status: "UNKNOWN", rank: 0 };
}

/** Maturity rank of a SystemStatus, for deciding whether an event advances it. */
const STATUS_RANK: Record<SystemStatus, number> = {
  UNKNOWN: 0,
  DEVELOPMENT: 1,
  TESTING: 4,
  FIELDED: 5,
  CANCELLED: 99, // terminal — never auto-advanced past
};

export function statusRank(status: SystemStatus): number {
  return STATUS_RANK[status] ?? 0;
}

export type RawMilestone = Record<string, unknown>;

/** A Program to upsert (by slug) before attaching the event. */
export interface ProgramDescriptor {
  slug: string;
  create: Prisma.ProgramCreateInput;
}

export interface NormalizeResult {
  data?: Prisma.MilestoneCreateInput;
  dedupeHash?: string;
  /** Present when the item carries a programSlug — caller upserts, then links. */
  program?: ProgramDescriptor;
  /** Event type of this item, if any — caller uses it to advance program status. */
  eventType?: EventType;
  error?: string;
}

/** Normalize an arbitrary label to a stable slug (mirror of scrapers' program_slug). */
export function programSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function str(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length ? t : undefined;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Parse a wire date (ISO string or yyyy-mm-dd) → Date, or null if absent. */
function parseDate(v: unknown, field: string): Date | null {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`invalid date for "${field}": ${JSON.stringify(v)}`);
  }
  return d;
}

export function computeDedupeHash(name: string, devStartDate: Date | null): string {
  const key = `${normalizeName(name)}|${devStartDate ? devStartDate.toISOString() : ""}`;
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Dedup key for a lifecycle event: sha256(programSlug|eventType|eventDate|sourceUrl).
 * Distinct events of the same program (solicitation, award, test…) hash apart,
 * while re-ingesting the same event is an idempotent upsert.
 */
export function computeEventDedupeHash(
  slug: string,
  eventType: EventType,
  eventDate: Date | null,
  sourceUrl: string,
): string {
  const key = `${slug}|${eventType}|${eventDate ? eventDate.toISOString() : ""}|${sourceUrl}`;
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Validate + normalize a single raw scraped item.
 * Returns either { data, dedupeHash } or { error }.
 */
export function normalizeMilestone(raw: RawMilestone): NormalizeResult {
  try {
    if (!raw || typeof raw !== "object") return { error: "item is not an object" };

    const name = str(raw.name);
    if (!name) return { error: "missing required field: name" };

    const actor = str(raw.actor) ?? "Unknown";

    const categoryRaw = str(raw.category);
    if (!categoryRaw) return { error: "missing required field: category" };
    if (!CATEGORY_VALUES.has(categoryRaw as Category)) {
      return { error: `invalid category: ${categoryRaw}` };
    }
    const category = categoryRaw as Category;

    // Source provenance is mandatory for scraped data (CLAUDE.md).
    const sourceUrl = str(raw.sourceUrl);
    const sourceName = str(raw.sourceName);
    if (!sourceUrl) return { error: "missing required field: sourceUrl" };
    if (!sourceName) return { error: "missing required field: sourceName" };

    const countryRaw = str(raw.country) ?? "US";
    if (!COUNTRY_VALUES.has(countryRaw as Country)) {
      return { error: `invalid country: ${countryRaw}` };
    }

    let systemStatus: SystemStatus | null = null;
    const ssRaw = str(raw.systemStatus);
    if (ssRaw) {
      if (!SYSTEM_STATUS_VALUES.has(ssRaw as SystemStatus)) {
        return { error: `invalid systemStatus: ${ssRaw}` };
      }
      systemStatus = ssRaw as SystemStatus;
    }

    const dates: Record<string, Date | null> = {};
    for (const f of DATE_FIELDS) dates[f] = parseDate(raw[f], f);

    let eventType: EventType | null = null;
    const etRaw = str(raw.eventType);
    if (etRaw) {
      if (!EVENT_TYPE_VALUES.has(etRaw as EventType)) {
        return { error: `invalid eventType: ${etRaw}` };
      }
      eventType = etRaw as EventType;
    }

    const additionalSources = Array.isArray(raw.additionalSources)
      ? raw.additionalSources.filter((x): x is string => typeof x === "string")
      : [];

    let contractValue: number | null = null;
    if (raw.contractValue != null && raw.contractValue !== "") {
      const n = Number(raw.contractValue);
      if (Number.isNaN(n)) return { error: `invalid contractValue: ${raw.contractValue}` };
      contractValue = n;
    }

    let significance = 1;
    if (raw.significance != null) {
      const n = Number(raw.significance);
      if (!Number.isInteger(n) || n < 1 || n > 5) {
        return { error: `significance must be an integer 1–5, got: ${raw.significance}` };
      }
      significance = n;
    }

    const data: Prisma.MilestoneCreateInput = {
      name,
      description: str(raw.description) ?? "",
      actor,
      country: countryRaw as Country,
      category,
      subcategory: str(raw.subcategory) ?? null,
      devStartDate: dates.devStartDate,
      procurementDate: dates.procurementDate,
      testDate: dates.testDate,
      testLocation: str(raw.testLocation) ?? null,
      fieldingDate: dates.fieldingDate,
      deploymentDate: dates.deploymentDate,
      eventType,
      eventDate: dates.eventDate,
      entryStatus: "PENDING", // forced — never auto-approve scraped data
      systemStatus,
      sourceUrl,
      sourceName,
      additionalSources,
      contractNumber: str(raw.contractNumber) ?? null,
      contractValue,
      issuingAgency: str(raw.issuingAgency) ?? null,
      awardedTo: str(raw.awardedTo) ?? null,
      significance,
    };

    // Build the program-link descriptor when the item carries a program.
    // programSlug is preferred; fall back to slugifying programName.
    let program: ProgramDescriptor | undefined;
    const slugRaw = str(raw.programSlug);
    const programName = str(raw.programName) ?? name;
    const slug = slugRaw ?? (str(raw.programName) ? programSlug(programName) : undefined);
    if (slug) {
      program = {
        slug,
        create: {
          slug,
          name: programName,
          actor,
          country: countryRaw as Country,
          category,
          subcategory: str(raw.subcategory) ?? null,
          significance,
        },
      };
    }

    // Dedup: event-based when we have a program + event type (distinct
    // lifecycle stages hash apart); otherwise the legacy name-based key.
    const dedupeHash =
      program && eventType
        ? computeEventDedupeHash(program.slug, eventType, dates.eventDate, sourceUrl)
        : computeDedupeHash(name, dates.devStartDate);

    return {
      data: { ...data, dedupeHash },
      dedupeHash,
      program,
      eventType: eventType ?? undefined,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
