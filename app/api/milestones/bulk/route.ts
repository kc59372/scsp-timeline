/**
 * POST /api/milestones/bulk — admin-only bulk approve/reject.
 * Body: { ids: string[], action: "approve" | "reject" }
 * Returns: { updated }
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { ids?: unknown; action?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { ids, action } = body;
  if (!Array.isArray(ids) || ids.some((x) => typeof x !== "string") || ids.length === 0) {
    return NextResponse.json({ error: "ids must be a non-empty string[]" }, { status: 400 });
  }
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: 'action must be "approve" or "reject"' }, { status: 400 });
  }

  const { count } = await prisma.milestone.updateMany({
    where: { id: { in: ids as string[] } },
    data: { entryStatus: action === "approve" ? "APPROVED" : "REJECTED" },
  });

  return NextResponse.json({ updated: count });
}
