/**
 * GET /api/milestones/[id] — single APPROVED milestone (public).
 *
 * 404 if the id is unknown or the entry is not APPROVED (so PENDING/REJECTED
 * entries can't be deep-linked publicly). PATCH lives in Phase 5 (admin).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const milestone = await prisma.milestone.findFirst({
    where: { id: params.id, entryStatus: "APPROVED" },
    include: { tags: true },
  });

  if (!milestone) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json(milestone);
}
