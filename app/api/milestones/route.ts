/**
 * GET /api/milestones — public read API (Phase 4 slice).
 *
 * Returns APPROVED milestones only. The public route NEVER exposes PENDING /
 * REJECTED entries — admin access (?status=PENDING) is gated behind auth in
 * Phase 5.
 *
 * Query params:
 *   ?category=<Category enum>   filter by category
 *   ?page=<n>        (default 1)
 *   ?pageSize=<n>    (default 500 — the timeline wants everything)
 *
 * Response: { items, total, page, pageSize }
 */
import { NextRequest, NextResponse } from "next/server";
import { Category } from "@prisma/client";
import { prisma } from "@/lib/db";

const CATEGORY_VALUES = new Set(Object.values(Category));
const DEFAULT_PAGE_SIZE = 500;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const where: { entryStatus: "APPROVED"; category?: Category } = {
    entryStatus: "APPROVED",
  };

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
      // Surface dated items chronologically; undated sink to the end.
      orderBy: [{ devStartDate: "asc" }, { createdAt: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.milestone.count({ where }),
  ]);

  return NextResponse.json({ items, total, page, pageSize });
}
