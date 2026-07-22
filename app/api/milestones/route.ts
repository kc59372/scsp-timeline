/**
 * /api/milestones
 *
 * GET  — public list of APPROVED milestones. Admins may request other statuses
 *        via ?status=PENDING|REJECTED|all (requires a valid admin session).
 * POST — admin-only manual create.
 *
 * Query params (GET):
 *   ?status=<EntryStatus|all>   admin-only when not APPROVED (default APPROVED)
 *   ?category=<Category enum>   filter by category
 *   ?page / ?pageSize           pagination (pageSize default 500, capped 1000;
 *                               pageSize=all returns every match, uncapped —
 *                               used by the full timeline so its count matches
 *                               the header's DB-wide total)
 */
import { NextRequest, NextResponse } from "next/server";
import { Category, EntryStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { canReadApi } from "@/lib/apiGuard";
import { normalizeMilestone } from "@/lib/ingest";

const CATEGORY_VALUES = new Set(Object.values(Category));
const STATUS_VALUES = new Set(Object.values(EntryStatus));
const DEFAULT_PAGE_SIZE = 500;

export async function GET(req: NextRequest) {
  // Data-API lock: only the internal server render (token) or an admin may read
  // the JSON API. Blocks direct browser/script bulk export (e.g. ?pageSize=all).
  if (!(await canReadApi(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;

  // Resolve requested status. Anything other than APPROVED is admin-gated.
  const statusParam = searchParams.get("status");
  let statusFilter: EntryStatus | "ALL" = "APPROVED";
  if (statusParam) {
    const upper = statusParam.toUpperCase();
    if (upper === "ALL") statusFilter = "ALL";
    else if (STATUS_VALUES.has(upper as EntryStatus)) statusFilter = upper as EntryStatus;
    else return NextResponse.json({ error: `invalid status: ${statusParam}` }, { status: 400 });

    if (statusFilter !== "APPROVED") {
      const session = await requireAdmin();
      if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const where: { entryStatus?: EntryStatus; category?: Category } = {};
  if (statusFilter !== "ALL") where.entryStatus = statusFilter;

  const category = searchParams.get("category");
  if (category) {
    if (!CATEGORY_VALUES.has(category as Category)) {
      return NextResponse.json({ error: `invalid category: ${category}` }, { status: 400 });
    }
    where.category = category as Category;
  }

  const pageSizeParam = searchParams.get("pageSize");
  const fetchAll = pageSizeParam === "all";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = fetchAll
    ? undefined
    : Math.min(1000, Math.max(1, Number(pageSizeParam) || DEFAULT_PAGE_SIZE));

  // Admin review views (anything but the public APPROVED list) surface
  // program-grouped events first, clustered by program name and ordered by
  // lifecycle date within each; ungrouped events (null program → NULLS LAST)
  // fall to the bottom. The public timeline keeps its chronological order.
  const orderBy: Prisma.MilestoneOrderByWithRelationInput[] =
    statusFilter === "APPROVED"
      ? [{ eventDate: "asc" }, { devStartDate: "asc" }, { createdAt: "asc" }]
      : [{ program: { name: "asc" } }, { eventDate: "asc" }, { createdAt: "asc" }];

  const [items, total] = await Promise.all([
    prisma.milestone.findMany({
      where,
      include: { tags: true, program: true },
      orderBy,
      skip: fetchAll ? undefined : (page - 1) * pageSize!,
      take: fetchAll ? undefined : pageSize,
    }),
    prisma.milestone.count({ where }),
  ]);

  return NextResponse.json({ items, total, page, pageSize: pageSize ?? total });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { data, error } = normalizeMilestone(body as Record<string, unknown>);
  if (error || !data) {
    return NextResponse.json({ error: error ?? "normalization failed" }, { status: 400 });
  }

  // normalizeMilestone forces PENDING; an admin may override the status on create.
  const raw = body as Record<string, unknown>;
  if (typeof raw.entryStatus === "string" && STATUS_VALUES.has(raw.entryStatus as EntryStatus)) {
    data.entryStatus = raw.entryStatus as EntryStatus;
  }

  const created = await prisma.milestone.create({ data, include: { tags: true } });
  return NextResponse.json(created, { status: 201 });
}
