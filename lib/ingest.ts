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
import { Prisma, Category, Country, SystemStatus } from "@prisma/client";

const CATEGORY_VALUES = new Set(Object.values(Category));
const COUNTRY_VALUES = new Set(Object.values(Country));
const SYSTEM_STATUS_VALUES = new Set(Object.values(SystemStatus));

/** Date fields accepted on the wire and mapped 1:1 onto the schema. */
const DATE_FIELDS = [
  "devStartDate",
  "procurementDate",
  "testDate",
  "fieldingDate",
  "deploymentDate",
] as const;

export type RawMilestone = Record<string, unknown>;

export interface NormalizeResult {
  data?: Prisma.MilestoneCreateInput;
  dedupeHash?: string;
  error?: string;
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

    const dedupeHash = computeDedupeHash(name, dates.devStartDate);
    return { data: { ...data, dedupeHash }, dedupeHash };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
