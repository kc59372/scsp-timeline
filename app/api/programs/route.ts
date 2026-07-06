/**
 * /api/programs
 *
 * GET  — list programs (lifecycle groupings) with event counts. Used by the
 *        admin merge tooling to pick a target program, and (later) by the
 *        public timeline to render lifecycle tracks. `?q=` filters by name.
 * POST — admin-only create of a new empty program (merge target).
 */
import { NextRequest, NextResponse } from "next/server";
import { Category, Country } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { programSlug } from "@/lib/ingest";

const CATEGORY_VALUES = new Set(Object.values(Category));
const COUNTRY_VALUES = new Set(Object.values(Country));

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const programs = await prisma.program.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : undefined,
    include: { _count: { select: { events: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ items: programs });
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

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const category = String(body.category ?? "");
  if (!CATEGORY_VALUES.has(category as Category)) {
    return NextResponse.json({ error: `invalid category: ${category}` }, { status: 400 });
  }

  const country = String(body.country ?? "US");
  if (!COUNTRY_VALUES.has(country as Country)) {
    return NextResponse.json({ error: `invalid country: ${country}` }, { status: 400 });
  }

  const slug =
    (typeof body.slug === "string" && body.slug.trim()) || programSlug(name);

  try {
    const program = await prisma.program.create({
      data: {
        slug,
        name,
        actor: typeof body.actor === "string" && body.actor.trim() ? body.actor.trim() : "Unknown",
        description: typeof body.description === "string" ? body.description : "",
        country: country as Country,
        category: category as Category,
        subcategory:
          typeof body.subcategory === "string" && body.subcategory.trim() ? body.subcategory.trim() : null,
      },
    });
    return NextResponse.json(program, { status: 201 });
  } catch {
    return NextResponse.json({ error: `a program with slug "${slug}" already exists` }, { status: 409 });
  }
}
