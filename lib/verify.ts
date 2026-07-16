/**
 * Ingest verification — a relevance + auto-approval gate that runs on every
 * scraped entry BEFORE it reaches the admin queue, to cut human review load.
 *
 * Two entry shapes are handled differently:
 *
 *   PROCUREMENT (SAM.gov / USAspending awards — high volume, structured):
 *     - Tier 1: names a curated program (scrapers/programs.json) → AUTO-APPROVE.
 *     - Tier 2: trips the AI/autonomy keyword filter → QUEUE (PENDING).
 *     - Tier 3: no keyword signal → LLM decides PENDING vs REJECTED (never
 *       auto-approves a contract; those approve only via the registry).
 *
 *   NEWS (DVIDS / service RSS — needs a semantic judgment the keywords can't
 *   make: "AI-driven exercise" is adoption, "workshop to discuss AI" is not,
 *   and the word "challenge" appears in BOTH a real exercise and a prize
 *   competition):
 *     - Tier 1: names a curated program → AUTO-APPROVE.
 *     - Otherwise → LLM 3-way triage against the curated rubric below:
 *         APPROVE  — AI/autonomy actually applied, demoed, used, deployed,
 *                    fielded, integrated, or automating a real task/mission
 *                    (incl. within an exercise/experiment), or concrete
 *                    activity on a specific named AI/autonomous system.
 *         REVIEW   — AI involved only peripherally (novelty use) or an indirect
 *                    investment in an external/academic program → PENDING.
 *         REJECT   — competitions/challenges/hackathons/prizes/proposal
 *                    deadlines, summits/workshops/offsites/"innovation days"
 *                    that only discuss/promote AI, items naming no specific
 *                    technology or application, non-defense uses, or items not
 *                    actually about AI/autonomy.
 *     - If ANTHROPIC_API_KEY is unset or the call fails/refuses → PENDING
 *       (safe: keep it in review).
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
    | "framing-review"
    | "rule-relevant"
    | "llm-approve"
    | "llm-review"
    | "llm-reject"
    | "llm-relevant"
    | "llm-irrelevant"
    | "llm-skipped"
    | "llm-error"
    | "heuristic-approve"
    | "heuristic-review"
    | "heuristic-reject";
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

// ── Non-milestone framing (never auto-approve) ───────────────────────────────
//
// The timeline tracks AI/autonomy *adoption* milestones — deployment, fielding,
// testing, and awards on real systems. Some scraped items instead cover a
// visit, a media package (video/podcast), a ceremony, or a competition result.
// Those are not milestones even when the article names a tracked program or
// trips an AI keyword (e.g. a celebrity "visit" whose body happens to mention
// "drone dominance"). An item whose FRAMING matches below never takes an
// auto-approve fast path — not registry, not news — and drops to PENDING for a
// human. We test the framing against the title/name, where this packaging
// reliably lives; body text is exactly where the coincidental matches that
// caused false auto-approvals occur. False positives are cheap here: a genuine
// milestone merely gets reviewed instead of auto-approved.
const NON_MILESTONE_PHRASES = [
  // media / promotional packaging
  "video:", "audio:", "watch:", "photos:", "gallery:", "b-roll", "photo essay",
  "image gallery", "in photos", "livestream", "live stream", "voices from",
  // celebrity / entertainment / morale
  "star of", "meet-and-greet", "meet and greet",
  // ceremonies / visits / tours / personnel recognition
  "ribbon-cutting", "ribbon cutting", "change of command", "retirement ceremony",
  "hall of fame", "distinguished visitor", "guest speaker", "award ceremony",
  "commander's call", "town hall",
  // competition RESULTS (the contest, not a fielded capability)
  "challenge winners", "take top spots", "top spots", "announces winners",
  "winners of",
];
const NON_MILESTONE_WORDS = [
  "visits", "visit", "tours", "celebrates", "celebrating", "podcast", "episode",
  "actor", "actress", "celebrity", "netflix", "hollywood", "autograph", "uso",
  "graduation", "commencement",
];

/**
 * True if an item's title reads as a visit / media package / ceremony /
 * competition result rather than an adoption milestone. Used to withhold the
 * auto-approve fast path (registry and news) and route the item to review.
 */
export function isNonMilestoneFraming(title: string): boolean {
  const t = (title ?? "").toLowerCase();
  if (NON_MILESTONE_PHRASES.some((p) => t.includes(p))) return true;
  return hasAny(t, NON_MILESTONE_WORDS);
}

// ── Deterministic fallback triage (used when ANTHROPIC_API_KEY is unset) ──────
//
// The LLM is the better judge, but this project runs without a key, so news
// items need a rules-only triage. These lists are HIGH-PRECISION signals drawn
// from human-labeled DVIDS/.mil examples and tuned so that, on that label set,
// nothing GOOD is auto-rejected and nothing BAD is auto-approved — ambiguous
// items fall through to PENDING (human review). This is coarser than the LLM:
// it will send some genuinely-good stories to PENDING rather than risk a wrong
// auto-decision. Substring match (lowercased); phrases include the "ai" token
// so they can't false-hit an incidental "ai".

// Talk-only / competition / non-defense framing → reject. None of these appear
// in any GOOD example. NOTE: bare "challenge" is deliberately absent — it occurs
// as a verb in a real exercise ("Iron Forge Challenges … in an AI-driven
// exercise"); only competition-shaped phrases are listed.
const REJECT_SIGNALS = [
  // gatherings that only discuss/promote AI
  "summit", "workshop", "offsite", "off-site", "symposium", "conference",
  "industry day", "innovation day", "hackathon", "town hall", "panel discussion",
  // competitions / prizes / solicita­tion-of-ideas
  "innovation challenge", "design challenge", "challenge teams", "prize",
  "cash award", "you could win", "could win $", "win $", "$50,000", "$50000",
  "proposal deadline", "call for proposals", "submission deadline",
  // broad "we should adopt AI" talk
  "prioritizes innovation", "explore ai", "explores ai", "exploring ai",
  "discuss ai", "discusses ai",
  // non-defense applications
  "forest", "reforestation", "wildfire", "wildlife",
];

// AI/autonomy actually being applied/used/fielded → approve. High-precision
// phrases; none appear in any BAD/MAYBE example.
const APPLY_SIGNALS = [
  "ai-driven", "ai driven", "ai-generated", "ai generated", "ai-enabled",
  "ai enabled", "ai-powered", "ai powered",
  "harnesses ai", "harness ai", "harnessed ai", "harnessing ai",
  "pioneers ai", "pioneer ai", "pioneering ai",
  "ai sprint", "showcase ai", "showcases ai", "showcasing ai", "ai dashboard",
  "automate", "automates", "automating", "automated",
  "systems integration", "ai integration", "integrates", "integrating ai",
  "integrated ai", "demonstrat", "deployed", "fielded",
];

const containsAny = (lower: string, phrases: string[]) =>
  phrases.filter((p) => lower.includes(p));

/**
 * Rules-only triage for when no LLM key is configured. Conservative by design:
 * auto-approve only on a clear "AI applied" signal, auto-reject only on a clear
 * "talk-only/competition/non-defense" signal (or no AI signal at all), and send
 * everything else — including mixed signals — to PENDING.
 */
function heuristicTriage(haystack: string, allowApprove: boolean): Verdict {
  if (!isRelevant(haystack)) {
    return {
      status: "REJECTED",
      method: "heuristic-reject",
      reason: "No AI/autonomy signal (rules-only; no LLM key)",
    };
  }
  const t = haystack.toLowerCase();
  const rejects = containsAny(t, REJECT_SIGNALS);
  const applies = containsAny(t, APPLY_SIGNALS);

  if (rejects.length && applies.length) {
    return {
      status: "PENDING",
      method: "heuristic-review",
      reason: `Mixed signals ("${rejects[0]}" vs "${applies[0]}") — needs review (rules-only)`,
    };
  }
  if (rejects.length) {
    return {
      status: "REJECTED",
      method: "heuristic-reject",
      reason: `Talk-only/competition/non-defense signal: "${rejects[0]}" (rules-only; no LLM key)`,
    };
  }
  if (applies.length) {
    return allowApprove
      ? {
          status: "APPROVED",
          method: "heuristic-approve",
          reason: `AI-applied signal: "${applies[0]}" (rules-only; no LLM key)`,
        }
      : {
          status: "PENDING",
          method: "heuristic-review",
          reason: "Relevant; queued for review (rules-only; no LLM key)",
        };
  }
  return {
    status: "PENDING",
    method: "heuristic-review",
    reason: "No decisive signal — queued for review (rules-only; no LLM key)",
  };
}

// ── LLM triage ───────────────────────────────────────────────────────────────

// The rubric below is calibrated against a set of human-labeled DVIDS/.mil
// examples. The decisive question is whether AI/autonomy is actually being
// *applied* (approve) versus merely discussed, competed over, or invested in
// elsewhere (review/reject). Keyword presence alone is not enough — e.g. the
// word "challenge" appears both in a real AI-driven exercise (approve) and in a
// prize competition (reject).
const LLM_SYSTEM = `You triage scraped US .mil/.gov news items for a US military AI adoption timeline (2016–2026). The timeline tracks US Department of Defense milestones where artificial intelligence or autonomy is actually adopted: fielded or in-development AI/autonomous systems (drones, unmanned vehicles, C2, ISR, targeting, logistics, cyber), AI applied within exercises/experiments/operations, AI automating real military tasks, and AI-related policy or directives.

Classify each item as exactly one of: "approve", "review", or "reject".

APPROVE — AI or autonomy is actually being applied, demonstrated, used, deployed, fielded, integrated, or is automating a real military task or mission — including inside an exercise, experiment, or operational workflow — OR the item reports concrete activity on a specific named AI/autonomous system or project. Modest mission relevance still counts if a specific AI application or system is clearly described. Examples of APPROVE:
- AI capabilities demonstrated during a military exercise.
- A service actively integrating an AI experiment (e.g., an AI "sprint" or named experiment).
- An AI tool/dashboard built and used by operators.
- Deployment or integration of specific unmanned/autonomous systems.
- Using AI to automate a real military process (e.g., the awards/paperwork process).
- Running an exercise that is AI-driven or uses AI-generated scenarios.

REVIEW — AI/autonomy is involved but only peripherally, as a novelty, or indirectly: a minor/gimmick use (e.g., an AI-generated mascot for a safety campaign), or an indirect investment in an external/academic research program that is not yet a fielded military capability. These need a human. Examples of REVIEW:
- An AI-generated mascot used to promote a safety culture.
- A defense agency funding an outside university AI research program.

REJECT — do NOT include:
- Competitions, challenges, hackathons, prize/cash-award announcements, or proposal/submission deadlines — these are about the contest or funding, not a fielded capability. (Note: "challenge" can also be an ordinary verb in a real exercise — judge by whether AI is actually applied, not by the word.)
- Summits, workshops, offsites, symposia, conferences, panels, "innovation days," or "industry days" that only discuss, explore, or promote adopting AI without applying a specific capability.
- Items that name no specific technology, system, project, or concrete application — only broad "AI adoption / innovation / force design" talk.
- Non-defense applications (e.g., environmental/forest work).
- Items that do not actually involve AI or autonomy.
- Media packages (VIDEO/AUDIO/podcast episodes, photo galleries), celebrity/entertainment or morale visits, ceremonies (ribbon-cutting, change of command, awards, hall of fame), tours, and "distinguished visitor" coverage — these report an event or media artifact, not the adoption of a capability, even when a real system is mentioned.
Examples of REJECT:
- "Meet the DARPA [X] Challenge teams" — a competition/hackathon about prize money.
- "Into algorithms? You could win $50,000" — a prize challenge, no specific system.
- An AI/ML "innovation challenge" proposal-deadline extension.
- An "AI summit" that accelerates broad capabilities but names no specific technology.
- Leaders "explore AI as a force multiplier" at a strategic offsite workshop.
- A directorate "hosts an Innovation Day" — an event about AI, not applying it.
- A command "prioritizes innovation" with a task force but names no specific technology.
- An interagency delegation "visits" an unmanned/AI task force — a visit, no specific project.

Lean toward APPROVE when a specific AI/autonomy application or system is clearly described. Lean toward REJECT for talk-only gatherings and competitions. Use REVIEW only for genuinely peripheral or indirect AI involvement.`;

const LLM_SCHEMA = {
  type: "object",
  properties: {
    decision: { type: "string", enum: ["approve", "review", "reject"] },
    reason: { type: "string" },
  },
  required: ["decision", "reason"],
  additionalProperties: false,
} as const;

type Decision = "approve" | "review" | "reject";

/**
 * LLM triage. `allowApprove` gates the "approve" → APPROVED mapping: news items
 * may be auto-approved, but procurement items never are (an "approve" verdict is
 * clamped to PENDING there — contracts auto-approve only via the registry).
 */
async function llmClassify(
  input: VerifyInput,
  haystack: string,
  allowApprove: boolean,
): Promise<Verdict> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      status: "PENDING",
      method: "llm-skipped",
      reason: "No ANTHROPIC_API_KEY set — entry defaulted to review",
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
    const parsed = JSON.parse(text.text) as { decision: Decision; reason: string };
    const reason = (parsed.reason ?? "").slice(0, 300);

    switch (parsed.decision) {
      case "approve":
        return allowApprove
          ? { status: "APPROVED", method: "llm-approve", reason: reason || "AI adoption applied (LLM)" }
          : { status: "PENDING", method: "llm-relevant", reason: reason || "Relevant (LLM); queued for review" };
      case "reject":
        return { status: "REJECTED", method: "llm-reject", reason: reason || "Not AI adoption (LLM)" };
      case "review":
      default:
        return { status: "PENDING", method: "llm-review", reason: reason || "Peripheral AI use (LLM)" };
    }
  } catch (e) {
    // Any failure (network, parse, rate limit) → keep the entry in review.
    return {
      status: "PENDING",
      method: "llm-error",
      reason: `LLM triage failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/**
 * Dispatch the ambiguous middle: the LLM 3-way triage when a key is configured,
 * otherwise the deterministic fallback. Both honor `allowApprove` (news may
 * auto-approve; procurement may not).
 */
function classifyUnknown(
  input: VerifyInput,
  haystack: string,
  allowApprove: boolean,
): Promise<Verdict> | Verdict {
  if (process.env.ANTHROPIC_API_KEY) return llmClassify(input, haystack, allowApprove);
  return heuristicTriage(haystack, allowApprove);
}

// ── Entry point ──────────────────────────────────────────────────────────────

/**
 * Classify a normalized scraped entry into APPROVED / PENDING / REJECTED.
 *
 * A curated-program match always auto-approves (fast path, no LLM). After that,
 * procurement awards stay on the cheap keyword path (they're high-volume and
 * structured), while news items go to the LLM 3-way triage — the only reliable
 * way to tell an AI-driven exercise from a workshop that merely discusses AI.
 */
export async function verifyEntry(input: VerifyInput): Promise<Verdict> {
  const haystack = `${input.name} ${input.description}`.trim();
  const program = matchProgram(haystack);

  // A visit / media package / ceremony / competition result is not an adoption
  // milestone, so it never auto-approves — not even a registry match (the fast
  // path that previously waved a celebrity "visit" through on a coincidental
  // body-text program match). Such items drop to PENDING for a human.
  const framing = isNonMilestoneFraming(input.name);

  // Tier 1 — names a tracked program → auto-approve. A curated-registry match
  // is high-confidence on its own (the registry is hand-maintained), so these
  // skip human review regardless of significance — UNLESS the title reads as a
  // non-milestone (visit/media/ceremony/competition), which goes to review.
  if (program) {
    if (framing) {
      return {
        status: "PENDING",
        method: "framing-review",
        reason: `Matches tracked program "${program.name}" but the title reads as a visit/media/ceremony item — needs review`,
      };
    }
    return {
      status: "APPROVED",
      method: "registry-autoapprove",
      reason: `Matches tracked program "${program.name}"`,
    };
  }

  // Procurement awards (SAM.gov / USAspending): structured, high-volume. Keep
  // the cheap keyword path — relevant → queue; otherwise let the LLM decide
  // queue-vs-reject. Contracts never LLM-auto-approve (allowApprove = false).
  // Procurement is now identified by provenance/shape, not the category (which
  // is inferred to a real domain like everything else). SAM.gov / USAspending
  // are the award sources; a non-null contractValue is a fallback signal.
  const isProcurement =
    input.sourceName === "SAM.gov" ||
    input.sourceName === "USAspending.gov" ||
    input.contractValue != null;
  if (isProcurement) {
    if (isRelevant(haystack)) {
      return { status: "PENDING", method: "rule-relevant", reason: "AI/autonomy keyword relevance" };
    }
    return classifyUnknown(input, haystack, /* allowApprove */ false);
  }

  // News (DVIDS / service RSS): semantic 3-way triage. Auto-approve genuine
  // AI-adoption stories, queue peripheral ones, and reject
  // talk-only/competition/non-defense items — via the LLM when a key is set, or
  // the deterministic fallback (this deployment) otherwise. Non-milestone
  // framing withholds auto-approve (allowApprove = false) → at most PENDING.
  return classifyUnknown(input, haystack, /* allowApprove */ !framing);
}
