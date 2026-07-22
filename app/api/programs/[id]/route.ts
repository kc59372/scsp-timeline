/**
 * GET /api/programs/[id] — a program with its lifecycle events.
 *
 * Public callers get only APPROVED events (so a program page never leaks
 * PENDING scraped data); an authenticated admin gets every event regardless of
 * status. 404 if the program doesn't exist or has no visible events publicly.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { canReadApi } from "@/lib/apiGuard";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!(await canReadApi(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const session = await requireAdmin();

  const program = await prisma.program.findUnique({
    where: { id: params.id },
    include: {
      events: {
        where: session ? undefined : { entryStatus: "APPROVED" },
        include: { tags: true, program: true },
        orderBy: [{ eventDate: "asc" }, { devStartDate: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!program) return NextResponse.json({ error: "not found" }, { status: 404 });
  // Publicly, a program with no approved events is effectively invisible.
  if (!session && program.events.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json(program);
}
