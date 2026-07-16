/**
 * TypeScript view of the curated program registry (scrapers/programs.json).
 *
 * The registry is the single source of truth for cross-source lifecycle
 * grouping; the Python scrapers (scrapers/programs.py) match item text against
 * it. This module mirrors that matcher so the server-side verifier
 * (lib/verify.ts) can decide, authoritatively, whether a scraped entry names a
 * *tracked* program — the signal that gates auto-approval.
 *
 * Matching rules (kept identical to programs.py):
 *   - `aliases`  match case-INSENSITIVELY as whole words/phrases.
 *   - `acronyms` match case-SENSITIVELY as whole words (so lowercase
 *     coincidences and ambiguous codes like "CCA" don't false-hit).
 *   - First registry entry with any hit wins (specific programs listed first).
 */
import registryJson from "@/scrapers/programs.json";

export interface RegistryEntry {
  slug: string;
  name: string;
  category: string;
  aliases?: string[];
  acronyms?: string[];
}

const REGISTRY: RegistryEntry[] = (registryJson as { programs?: RegistryEntry[] }).programs ?? [];
const SLUGS = new Set(REGISTRY.map((e) => e.slug));

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hasPhrase = (lower: string, phrase: string) =>
  new RegExp(`(?<!\\w)${esc(phrase.toLowerCase())}(?!\\w)`).test(lower);
const hasAcronym = (text: string, acr: string) =>
  new RegExp(`(?<!\\w)${esc(acr)}(?!\\w)`).test(text);

/** Return the curated program whose alias/acronym appears in `text`, else null. */
export function matchProgram(text: string): RegistryEntry | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const e of REGISTRY) {
    if ((e.aliases ?? []).some((a) => hasPhrase(lower, a))) return e;
    if ((e.acronyms ?? []).some((a) => hasAcronym(text, a))) return e;
  }
  return null;
}

/** True if `slug` is a curated-program slug (used as a secondary guard). */
export function isRegisteredSlug(slug: string | undefined | null): boolean {
  return !!slug && SLUGS.has(slug);
}
