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

/** JSON-serialized Milestone (dates are ISO strings over the wire). */
export interface Milestone {
  id: string;
  name: string;
  description: string;
  actor: string;
  country: string;
  category: string;
  subcategory: string | null;
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
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function fetchMilestones(
  params: { category?: string; page?: number; pageSize?: number } = {},
): Promise<MilestonesResponse> {
  const qs = new URLSearchParams();
  if (params.category) qs.set("category", params.category);
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));

  const url = `${baseUrl()}/api/milestones${qs.toString() ? `?${qs}` : ""}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`fetchMilestones failed: ${res.status}`);
  return res.json();
}

export async function fetchMilestone(id: string): Promise<Milestone | null> {
  const res = await fetch(`${baseUrl()}/api/milestones/${id}`, { cache: "no-store" });
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
    headers: { cookie },
  });
  if (!res.ok) throw new Error(`fetchMilestonesAdmin failed: ${res.status}`);
  return res.json();
}

export async function fetchMilestoneAdmin(id: string, cookie: string): Promise<Milestone | null> {
  const res = await fetch(`${baseUrl()}/api/milestones/${id}`, {
    cache: "no-store",
    headers: { cookie },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`fetchMilestoneAdmin failed: ${res.status}`);
  return res.json();
}
