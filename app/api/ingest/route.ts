/**
 * POST /api/ingest — scraper ingest endpoint (Phase 3 minimal slice).
 *
 * Accepts a single normalized milestone object or an array of them. Each item
 * is validated + normalized (lib/ingest.ts), forced to entryStatus=PENDING, and
 * upserted by dedupeHash so re-ingesting the same item is a no-op.
 *
 * Response (HTTP 200, even with per-item errors):
 *   { received, inserted, skipped, errors: [{ index, name?, error }] }
 * HTTP 400 only if the whole body is unparseable / not object|array.
 *
 * Auth: if INGEST_TOKEN is set, requests must send `Authorization: Bearer <token>`
 * (401 otherwise). When unset, the endpoint is open — fine for local dev, but
 * production MUST set INGEST_TOKEN (see DEPLOY.md).
 */
import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeMilestone, type RawMilestone } from "@/lib/ingest";

/** Constant-time compare of the Bearer token against INGEST_TOKEN. */
function tokenOk(req: NextRequest): boolean {
  const expected = process.env.INGEST_TOKEN;
  if (!expected) return true; // not configured → open (dev only)
  const header = req.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!tokenOk(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const items: unknown[] = Array.isArray(body) ? body : [body];
  if (items.length === 0) {
    return NextResponse.json({ error: "empty payload" }, { status: 400 });
  }

  let inserted = 0;
  let skipped = 0;
  const errors: { index: number; name?: string; error: string }[] = [];

  for (let i = 0; i < items.length; i++) {
    const raw = items[i] as RawMilestone;
    const { data, dedupeHash, error } = normalizeMilestone(raw);

    if (error || !data || !dedupeHash) {
      errors.push({ index: i, name: (raw?.name as string) ?? undefined, error: error ?? "normalization failed" });
      continue;
    }

    try {
      const existing = await prisma.milestone.findUnique({
        where: { dedupeHash },
        select: { id: true },
      });

      if (existing) {
        // Known item — refresh its fields but keep it in review (PENDING).
        await prisma.milestone.update({ where: { dedupeHash }, data });
        skipped++;
      } else {
        await prisma.milestone.create({ data });
        inserted++;
      }
    } catch (e) {
      errors.push({
        index: i,
        name: data.name,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return NextResponse.json({
    received: items.length,
    inserted,
    skipped,
    errors,
  });
}
