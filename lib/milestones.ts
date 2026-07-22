/**
 * Client/server-shared milestone DTO + data-fetch helpers.
 *
 * Components fetch via these helpers (HTTP → /api/milestones); only API routes
 * touch Prisma directly (CLAUDE.md: no direct DB calls from components).
 */

export interface Tag {
  id: string;
  name: string;
}

/** JSON-serialized Program (lifecycle grouping) over the wire. */
export interface Program {
  id: string;
  slug: string;
  name: string;
  description: string;
  actor: string;
  country: string;
  category: string;
  subcategory: string | null;
  systemStatus: string | null;
  significance: number;
  createdAt: string;
  updatedAt: string;
  /** Present on the /api/programs list response. */
  _count?: { events: number };
}

/** JSON-serialized Milestone (dates are ISO strings over the wire). */
export interface Milestone {
  id: string;
  name: string;
  description: string;
  actor: string;
  country: string;
  category: string;
  subcategory: string | null;
  programId: string | null;
  program?: Program | null;
  eventType: string | null;
  eventDate: string | null;
  devStartDate: string | null;
  procurementDate: string | null;
  testDate: string | null;
  testLocation: string | null;
  fieldingDate: string | null;
  deploymentDate: string | null;
  entryStatus: string;
  systemStatus: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  additionalSources: string[];
  contractNumber: string | null;
  contractValue: number | null;
  issuingAgency: string | null;
  awardedTo: string | null;
  significance: number;
  reviewNote: string | null;
  /** Verifier rationale set at ingest (why auto-approved / queued / rejected). */
  verifyReason: string | null;
  createdAt: string;
  updatedAt: string;
  tags: Tag[];
}

export interface MilestonesResponse {
  items: Milestone[];
  total: number;
  page: number;
  pageSize: number;
}

function baseUrl(): string {
  // These are self-referential fetches (a server component calling this app's
  // own API route). On Vercel, VERCEL_URL is the current deployment's own host,
  // so it always points at the right deployment — more robust than a hand-set
  // domain (which can be a stale placeholder or point at a different deploy).
  // Requires the deployment to be publicly reachable (disable Vercel Deployment
  // Protection); the app's own NextAuth still guards /admin.
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  // Local dev / non-Vercel hosts: explicit override, else localhost.
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/**
 * Header the app's own server components attach so the (locked) data API accepts
 * the internal render call — see lib/apiGuard.ts. No-op if INTERNAL_API_TOKEN is
 * unset. These helpers run server-side; in a client bundle the non-public env
 * var resolves to undefined (never inlined), so the token can't leak.
 */
function internalHeaders(base: Record<string, string> = {}): Record<string, string> {
  const token = process.env.INTERNAL_API_TOKEN;
  return token ? { ...base, "x-internal-token": token } : base;
}

export async function fetchMilestones(
  params: { category?: string; page?: number; pageSize?: number | "all" } = {},
): Promise<MilestonesResponse> {
  const qs = new URLSearchParams();
  if (params.category) qs.set("category", params.category);
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));

  const url = `${baseUrl()}/api/milestones${qs.toString() ? `?${qs}` : ""}`;
  const res = await fetch(url, { cache: "no-store", headers: internalHeaders() });
  if (!res.ok) throw new Error(`fetchMilestones failed: ${res.status}`);
  return res.json();
}

export async function fetchMilestone(id: string): Promise<Milestone | null> {
  const res = await fetch(`${baseUrl()}/api/milestones/${id}`, {
    cache: "no-store",
    headers: internalHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`fetchMilestone failed: ${res.status}`);
  return res.json();
}

/**
 * Admin reads — forward the caller's session cookie so the admin-gated API
 * accepts the request (keeps one data path: components → API, never DB).
 * Used by /admin server components (which read cookies() and pass them here).
 */
export async function fetchMilestonesAdmin(
  cookie: string,
  params: { status?: string; category?: string } = {},
): Promise<MilestonesResponse> {
  const qs = new URLSearchParams();
  qs.set("status", params.status ?? "PENDING");
  if (params.category) qs.set("category", params.category);
  const res = await fetch(`${baseUrl()}/api/milestones?${qs}`, {
    cache: "no-store",
    headers: internalHeaders({ cookie }),
  });
  if (!res.ok) throw new Error(`fetchMilestonesAdmin failed: ${res.status}`);
  return res.json();
}

/** A program plus its lifecycle events (from /api/programs/[id]). */
export interface ProgramWithEvents extends Program {
  events: Milestone[];
}

/** Fetch one program with its (approved, for public) lifecycle events. */
export async function fetchProgram(id: string, cookie?: string): Promise<ProgramWithEvents | null> {
  const res = await fetch(`${baseUrl()}/api/programs/${id}`, {
    cache: "no-store",
    headers: internalHeaders(cookie ? { cookie } : {}),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`fetchProgram failed: ${res.status}`);
  return res.json();
}

/** List programs (merge targets). Optionally filter by name via `q`. */
export async function fetchPrograms(
  cookie?: string,
  q?: string,
): Promise<Program[]> {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  const res = await fetch(`${baseUrl()}/api/programs${qs}`, {
    cache: "no-store",
    headers: internalHeaders(cookie ? { cookie } : {}),
  });
  if (!res.ok) throw new Error(`fetchPrograms failed: ${res.status}`);
  const data = await res.json();
  return data.items as Program[];
}

export async function fetchMilestoneAdmin(id: string, cookie: string): Promise<Milestone | null> {
  const res = await fetch(`${baseUrl()}/api/milestones/${id}`, {
    cache: "no-store",
    headers: internalHeaders({ cookie }),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`fetchMilestoneAdmin failed: ${res.status}`);
  return res.json();
}
