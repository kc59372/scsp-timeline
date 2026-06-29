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
 *   ?page / ?pageSize           pagination (pageSize default 500)
 */
import { NextRequest, NextResponse } from "next/server";
import { Category, EntryStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { normalizeMilestone } from "@/lib/ingest";

const CATEGORY_VALUES = new Set(Object.values(Category));
const STATUS_VALUES = new Set(Object.values(EntryStatus));
const DEFAULT_PAGE_SIZE = 500;

export async function GET(req: NextRequest) {
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

  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(1000, Math.max(1, Number(searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE));

  const [items, total] = await Promise.all([
    prisma.milestone.findMany({
      where,
      include: { tags: true },
      orderBy: [{ devStartDate: "asc" }, { createdAt: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.milestone.count({ where }),
  ]);

  return NextResponse.json({ items, total, page, pageSize });
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
