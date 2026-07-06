/**
 * POST /api/milestones/merge — admin-only. Group events under one Program.
 *
 * Body:
 *   { ids: string[], programId: string }                    // link to existing
 *   { ids: string[], newProgram: { name, category, ... } }  // create + link
 *   { ids: string[], programId: null }                      // detach (ungroup)
 *
 * After (re)assignment the target program's systemStatus is recomputed from the
 * furthest-along event now attached to it. Returns { updated, programId }.
 */
import { NextRequest, NextResponse } from "next/server";
import { Category, Country, SystemStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { eventStatus, programSlug } from "@/lib/ingest";

const CATEGORY_VALUES = new Set(Object.values(Category));

/** Recompute a program's systemStatus from the max-rank event attached to it. */
async function recomputeStatus(programId: string): Promise<void> {
  const events = await prisma.milestone.findMany({
    where: { programId },
    select: { eventType: true },
  });
  let status: SystemStatus | null = null;
  let bestRank = 0;
  for (const e of events) {
    if (!e.eventType) continue;
    const s = eventStatus(e.eventType);
    if (s.rank > bestRank) {
      bestRank = s.rank;
      status = s.status;
    }
  }
  await prisma.program.update({ where: { id: programId }, data: { systemStatus: status } });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const ids = body.ids;
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((x) => typeof x !== "string")) {
    return NextResponse.json({ error: "ids must be a non-empty string[]" }, { status: 400 });
  }

  // Detach case — ungroup the events.
  if (body.programId === null) {
    const { count } = await prisma.milestone.updateMany({
      where: { id: { in: ids as string[] } },
      data: { programId: null },
    });
    return NextResponse.json({ updated: count, programId: null });
  }

  // Resolve the target program: existing by id, or create from newProgram.
  let targetId: string;
  if (typeof body.programId === "string" && body.programId) {
    const exists = await prisma.program.findUnique({ where: { id: body.programId }, select: { id: true } });
    if (!exists) return NextResponse.json({ error: "program not found" }, { status: 404 });
    targetId = exists.id;
  } else if (body.newProgram && typeof body.newProgram === "object") {
    const np = body.newProgram as Record<string, unknown>;
    const name = typeof np.name === "string" ? np.name.trim() : "";
    if (!name) return NextResponse.json({ error: "newProgram.name is required" }, { status: 400 });
    const category = String(np.category ?? "");
    if (!CATEGORY_VALUES.has(category as Category)) {
      return NextResponse.json({ error: `invalid category: ${category}` }, { status: 400 });
    }
    const slug = (typeof np.slug === "string" && np.slug.trim()) || programSlug(name);
    // Reuse a program with this slug if it already exists (idempotent merge).
    const program = await prisma.program.upsert({
      where: { slug },
      create: {
        slug,
        name,
        actor: typeof np.actor === "string" && np.actor.trim() ? np.actor.trim() : "Unknown",
        description: typeof np.description === "string" ? np.description : "",
        country: (typeof np.country === "string" ? np.country : "US") as Country,
        category: category as Category,
        subcategory: typeof np.subcategory === "string" && np.subcategory.trim() ? np.subcategory.trim() : null,
      },
      update: {},
      select: { id: true },
    });
    targetId = program.id;
  } else {
    return NextResponse.json({ error: "provide programId or newProgram" }, { status: 400 });
  }

  const { count } = await prisma.milestone.updateMany({
    where: { id: { in: ids as string[] } },
    data: { programId: targetId },
  });

  await recomputeStatus(targetId);
  return NextResponse.json({ updated: count, programId: targetId });
}
