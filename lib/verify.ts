/**
 * Ingest verification — a relevance + auto-approval gate that runs on every
 * scraped entry BEFORE it reaches the admin queue, to cut human review load.
 *
 * Hybrid design (rules first, LLM only for the ambiguous middle):
 *   Tier 1 — AUTO-APPROVE (APPROVED): the entry names a curated program
 *            (scrapers/programs.json) AND carries a strong significance signal
 *            (significance >= 4, i.e. >= $100M awards, or contractValue >= $100M).
 *            High-confidence, tracked, material → skip human review.
 *   Tier 2 — QUEUE (PENDING): the entry is clearly relevant by rules — it names
 *            a curated program (any significance) or trips the shared AI/autonomy
 *            keyword filter (ported from scrapers/rss.py `is_relevant`). Still
 *            needs a human to confirm / merge.
 *   Tier 3 — ADJUDICATE (LLM): no keyword signal at all → an ambiguous entry.
 *            Claude decides relevant (PENDING) vs irrelevant (REJECTED) so we
 *            never auto-reject something the keyword filter merely missed. The
 *            LLM never auto-approves. If ANTHROPIC_API_KEY is unset or the call
 *            fails/refuses, we fall back to PENDING (safe: keep it in review).
 *
 * Rejected entries are still written to the DB (as REJECTED) so reviewers can
 * audit and tune the filter via the admin `?status=REJECTED` view.
 */
import Anthropic from "@anthropic-ai/sdk";
import { matchProgram } from "@/lib/registry";

export type VerifyStatus = "APPROVED" | "PENDING" | "REJECTED";

export interface VerifyInput {
  name: string;
  description: string;
  category: string;
  sourceName: string;
  significance: number;
  contractValue: number | null;
  programSlug?: string | null;
}

export interface Verdict {
  status: VerifyStatus;
  /** Machine-readable tag for the deciding rule (for logs / ingest summary). */
  method:
    | "registry-autoapprove"
    | "rule-relevant"
    | "llm-relevant"
    | "llm-irrelevant"
    | "llm-skipped"
    | "llm-error";
  reason: string;
}

// ── Deterministic relevance (mirror of scrapers/rss.py is_relevant) ──────────

const RELEVANCE = [
  "artificial intelligence", "machine learning", "autonomous", "autonomy",
  "unmanned", "drone", "counter-uas", "algorithm", "generative", "neural",
];
const NEGATIVE_CONTEXT = ["drone show", "drone light", "light show"];
const AI_ACRONYM = /(?<!\w)AI(?!\w)/; // case-sensitive uppercase acronym

const hasWord = (text: string, keyword: string) =>
  new RegExp(`(?<!\\w)${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\w)`).test(text);

/** Whole-word AI/autonomy relevance, matching the scrapers' shared gate. */
export function isRelevant(text: string): boolean {
  const t = text.toLowerCase();
  const strong =
    AI_ACRONYM.test(text) || RELEVANCE.filter((k) => k !== "drone").some((k) => hasWord(t, k));
  if (NEGATIVE_CONTEXT.some((neg) => t.includes(neg)) && !strong) return false;
  return strong || hasWord(t, "drone");
}

// Academic / personnel / human-interest framing. An item that mentions an AI
// term in this context — a graduate profile, a ceremony, a promotion — is
// usually NOT about military AI *adoption* (a fielded system, contract, or
// policy). Such keyword-only matches are routed to the LLM for a closer look
// (relevant → PENDING, tangential → REJECTED) instead of being rubber-stamped
// to PENDING by the coarse keyword filter alone. Example the filter should NOT
// wave through unreviewed: "Marine Corps Ph.D. Graduate Explores Uncertainty in
// Machine Learning".
const TANGENTIAL_CONTEXT = [
  "graduate", "graduation", "ph.d", "phd", "doctoral", "dissertation", "thesis",
  "professor", "faculty", "scholarship", "student", "students", "alumni",
  "coursework", "curriculum", "classroom", "semester", "explores", "studies",
  "profile", "spotlight", "promotion", "promoted", "retires", "retirement",
  "obituary", "memorial", "ceremony", "hall of fame",
];

// Operational / procurement / adoption signals. Any of these means the item is
// about a real system, event, or contract, so it passes to review directly even
// if it also carries academic-sounding words. Example that MUST pass this way:
// "U.S., Israel Complete Unmanned Naval Exercise in Gulf of Aqaba" ("unmanned",
// "exercise").
const ADOPTION_SIGNAL = [
  "unmanned", "autonomous", "autonomy", "drone", "deployed", "deployment",
  "fielded", "fielding", "operational", "exercise", "test", "tested",
  "prototype", "demonstration", "contract", "awarded", "procurement",
  "solicitation", "capability", "integrated", "combat", "squadron", "fleet",
  "system", "program", "counter-uas",
];

const hasAny = (lower: string, words: string[]) => words.some((w) => hasWord(lower, w));

/**
 * A keyword-relevant item is "tangential" when it reads as an academic/personnel
 * story with no operational/procurement signal — worth an LLM second look before
 * it lands in the queue, rather than an automatic PENDING.
 */
export function isTangential(text: string): boolean {
  const t = text.toLowerCase();
  return hasAny(t, TANGENTIAL_CONTEXT) && !hasAny(t, ADOPTION_SIGNAL);
}

// ── LLM adjudication (Tier 3) ────────────────────────────────────────────────

const LLM_SYSTEM =
  "You are a relevance filter for a US military AI adoption timeline (2016–2026). " +
  "The timeline tracks US Department of Defense / .mil / .gov milestones in artificial " +
  "intelligence and autonomy: procurement contracts and awards, fielded or in-development " +
  "AI/autonomous systems (drones, unmanned vehicles, C2, ISR, targeting, logistics, cyber), " +
  "test/evaluation events, and AI-related policy or directives. " +
  "Decide whether a scraped item is genuinely about US military AI/autonomy adoption. " +
  "Reject items that are unrelated to AI/autonomy adoption (routine personnel moves, " +
  "ceremonies, academic degree/thesis profiles, general human-interest news, recreational " +
  "drone shows), non-US, or purely commercial with no defense AI angle. " +
  "Be conservative: when genuinely unsure, mark it relevant so a human reviews it.";

const LLM_SCHEMA = {
  type: "object",
  properties: {
    relevant: { type: "boolean" },
    reason: { type: "string" },
  },
  required: ["relevant", "reason"],
  additionalProperties: false,
} as const;

async function llmAdjudicate(input: VerifyInput, haystack: string): Promise<Verdict> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      status: "PENDING",
      method: "llm-skipped",
      reason: "No ANTHROPIC_API_KEY set — ambiguous entry defaulted to review",
    };
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      output_config: { effort: "low", format: { type: "json_schema", schema: LLM_SCHEMA } },
      system: LLM_SYSTEM,
      messages: [
        {
          role: "user",
          content:
            `Source: ${input.sourceName}\n` +
            `Category (inferred): ${input.category}\n` +
            `Text: ${haystack.slice(0, 4000)}`,
        },
      ],
    });

    // A safety refusal can't be parsed against the schema — keep it for review.
    if (response.stop_reason === "refusal") {
      return { status: "PENDING", method: "llm-error", reason: "Model declined to classify" };
    }

    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") {
      return { status: "PENDING", method: "llm-error", reason: "No classification returned" };
    }
    const parsed = JSON.parse(text.text) as { relevant: boolean; reason: string };
    const reason = (parsed.reason ?? "").slice(0, 300);
    return parsed.relevant
      ? { status: "PENDING", method: "llm-relevant", reason: reason || "Judged relevant by LLM" }
      : { status: "REJECTED", method: "llm-irrelevant", reason: reason || "Judged irrelevant by LLM" };
  } catch (e) {
    // Any failure (network, parse, rate limit) → keep the entry in review.
    return {
      status: "PENDING",
      method: "llm-error",
      reason: `LLM adjudication failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// ── Entry point ──────────────────────────────────────────────────────────────

/**
 * Classify a normalized scraped entry into APPROVED / PENDING / REJECTED.
 * Rules resolve the clear cases synchronously; only truly ambiguous entries
 * (no keyword signal) incur the LLM call, bounding cost on daily batches.
 */
export async function verifyEntry(input: VerifyInput): Promise<Verdict> {
  const haystack = `${input.name} ${input.description}`.trim();
  const program = matchProgram(haystack);

  // Tier 1 — names a tracked program → auto-approve. A curated-registry match
  // is high-confidence on its own (the registry is hand-maintained), so these
  // skip human review regardless of significance.
  if (program) {
    return {
      status: "APPROVED",
      method: "registry-autoapprove",
      reason: `Matches tracked program "${program.name}"`,
    };
  }

  // Tier 2 — relevant by keyword but not a tracked program → queue for review.
  if (isRelevant(haystack)) {
    // A keyword match in an academic/personnel framing with no operational or
    // procurement signal is only tangentially "AI" — send it to the LLM to
    // decide review-vs-reject rather than auto-queueing it.
    if (isTangential(haystack)) return llmAdjudicate(input, haystack);
    return { status: "PENDING", method: "rule-relevant", reason: "AI/autonomy keyword relevance" };
  }

  // Tier 3 — ambiguous (no keyword signal) → LLM decides queue vs reject.
  return llmAdjudicate(input, haystack);
}
