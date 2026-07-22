/**
 * Airtable review sink.
 *
 * Entries that land in PENDING (i.e. a human must review them) are POSTed to an
 * Airtable table, giving the team a review surface in Airtable *in addition to*
 * the in-app admin queue. This does not replace the DB pipeline — the entry is
 * still written to Postgres with its verdict; this is a best-effort side-channel
 * that never blocks or fails ingest.
 *
 * CONFIG:
 *   - The API key is a SECRET, so it comes from the environment
 *     (`AIRTABLE_API_KEY`) — never hardcoded, so it can't leak into git history.
 *     Set it in `.env` locally and in the Vercel project settings.
 *   - Base id and table name are not secrets; they're hardcoded PLACEHOLDERS
 *     below, to be filled in once the base exists.
 * Until BOTH the env key is set AND the base/table placeholders are filled in,
 * `postToAirtable()` is a no-op (returns { ok: false, reason }), so ingest keeps
 * working unchanged in the meantime.
 *
 * The API is Airtable's REST "create records" endpoint:
 *   POST https://api.airtable.com/v0/{baseId}/{table}
 *   Authorization: Bearer {apiKey}
 * A personal access token needs the `data.records:write` scope on the base.
 * (Airtable "forms" don't accept API submissions — records are created via this
 * REST endpoint and then show up in whatever view/form-backed table you point
 * it at.)
 */

// ── Config — base/table are non-secret; FILL IN LATER ────────────────────────
// Base id — e.g. "appXXXXXXXXXXXXXX"
const AIRTABLE_BASE_ID = "PLACEHOLDER_AIRTABLE_BASE_ID";
// Table name or table id where review records are created — e.g. "Pending Review"
const AIRTABLE_TABLE = "PLACEHOLDER_AIRTABLE_TABLE";
// The Bearer token is a secret — supplied via env, never committed. See .env.example.
// ─────────────────────────────────────────────────────────────────────────────

const PLACEHOLDER_PREFIX = "PLACEHOLDER_";

/** The record fields we send for a review entry (mapped to Airtable columns). */
export interface AirtableRecord {
  name: string;
  description: string;
  actor: string;
  category: string;
  eventType?: string | null;
  eventDate?: Date | string | null;
  sourceName: string;
  sourceUrl: string;
  contractValue?: number | null;
  significance: number;
  entryStatus: string;
  verifyReason: string;
}

/** True once the env key is set AND the base/table config is filled in. */
export function airtableConfigured(): boolean {
  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) return false;
  return ![AIRTABLE_BASE_ID, AIRTABLE_TABLE].some((v) => v.startsWith(PLACEHOLDER_PREFIX));
}

/** yyyy-mm-dd (Airtable date field), or "" if absent/unparseable. */
function toDateString(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/**
 * Map a review entry to Airtable's column names. These are best-guess column
 * labels — adjust them to match the actual Airtable table once it exists. With
 * `typecast: true` (set below), Airtable coerces values into existing field
 * types and creates single-select options on the fly.
 */
function toFields(rec: AirtableRecord): Record<string, unknown> {
  return {
    Name: rec.name,
    Description: rec.description,
    Actor: rec.actor,
    Category: rec.category,
    "Event Type": rec.eventType ?? "",
    "Event Date": toDateString(rec.eventDate),
    "Source Name": rec.sourceName,
    "Source URL": rec.sourceUrl,
    "Contract Value": rec.contractValue ?? null,
    Significance: rec.significance,
    "Entry Status": rec.entryStatus,
    "Verify Reason": rec.verifyReason,
  };
}

/**
 * Best-effort POST of one review entry to Airtable. Never throws — returns a
 * result the caller can log. No-ops (ok:false) while the config is still
 * placeholder, so nothing breaks before the credentials are supplied.
 */
export async function postToAirtable(rec: AirtableRecord): Promise<{ ok: boolean; reason?: string }> {
  if (!airtableConfigured()) {
    return { ok: false, reason: "airtable not configured (placeholder credentials)" };
  }

  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ typecast: true, fields: toFields(rec) }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, reason: `airtable ${res.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
