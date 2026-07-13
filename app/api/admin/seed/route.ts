/**
 * POST /api/admin/seed — one-time curated-seed loader, over HTTPS.
 *
 * Exists because some networks (corporate TLS proxies) block the raw Postgres
 * port, so `prisma db seed` can't be run against the managed DB from a laptop.
 * This route runs the same seed logic (prisma/seed.ts `runSeed`) inside the
 * deployed app, where the DB is reachable.
 *
 * Auth: requires `Authorization: Bearer <INGEST_TOKEN>` (same secret as
 * /api/ingest). Returns 401 otherwise; 403 if INGEST_TOKEN is unset.
 *
 * Safety: seeding is DESTRUCTIVE (clears the milestone + program tables). This
 * route refuses to run when the DB already has data unless called with
 * `?force=true`, so it can't silently wipe approved/scraped entries.
 */
import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runSeed } from "@/prisma/seed";

export const maxDuration = 60; // seeding does many sequential writes

function tokenOk(req: NextRequest): boolean {
  const expected = process.env.INGEST_TOKEN;
  if (!expected) return false; // must be configured to use this route
  const header = req.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!process.env.INGEST_TOKEN) {
    return NextResponse.json({ error: "INGEST_TOKEN not configured" }, { status: 403 });
  }
  if (!tokenOk(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const force = new URL(req.url).searchParams.get("force") === "true";
  const existing = (await prisma.program.count()) + (await prisma.milestone.count());
  if (existing > 0 && !force) {
    return NextResponse.json(
      {
        error: "database not empty",
        detail: `${existing} rows present. Seeding is destructive; re-run with ?force=true to overwrite.`,
      },
      { status: 409 },
    );
  }

  try {
    const summary = await runSeed();
    return NextResponse.json({ seeded: true, ...summary });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
