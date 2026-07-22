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
 * production MUST set INGEST_TOKEN (see DEPLOY_VERCEL.md).
 */
import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { normalizeMilestone, eventStatus, statusRank, type RawMilestone } from "@/lib/ingest";
import { verifyEntry, type VerifyStatus } from "@/lib/verify";
import { postToAirtable } from "@/lib/airtable";

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
  // Verification outcome tally (new inserts only — see below).
  const verdicts: Record<VerifyStatus, number> = { APPROVED: 0, PENDING: 0, REJECTED: 0 };
  const errors: { index: number; name?: string; error: string }[] = [];

  for (let i = 0; i < items.length; i++) {
    const raw = items[i] as RawMilestone;
    const { data, dedupeHash, program, eventType, error } = normalizeMilestone(raw);

    if (error || !data || !dedupeHash) {
      errors.push({ index: i, name: (raw?.name as string) ?? undefined, error: error ?? "normalization failed" });
      continue;
    }

    try {
      // Upsert the parent Program (by slug) and link the event to it. On an
      // existing program we don't clobber curated fields — we only advance
      // systemStatus toward the furthest-along lifecycle stage seen.
      let createData: Prisma.MilestoneCreateInput = data;
      if (program) {
        const prog = await prisma.program.upsert({
          where: { slug: program.slug },
          create: program.create,
          update: {},
          select: { id: true, systemStatus: true },
        });

        if (eventType) {
          const next = eventStatus(eventType);
          const currentRank = prog.systemStatus ? statusRank(prog.systemStatus) : -1;
          if (next.rank > 0 && statusRank(next.status) > currentRank) {
            await prisma.program.update({
              where: { id: prog.id },
              data: { systemStatus: next.status },
            });
          }
        }

        createData = { ...data, program: { connect: { id: prog.id } } };
      }

      const existing = await prisma.milestone.findUnique({
        where: { dedupeHash },
        select: { id: true },
      });

      if (existing) {
        // Known item — refresh its fields but PRESERVE admin-curated fields.
        // Re-ingesting must not undo an admin's approve/reject or re-trigger
        // verification (entryStatus), nor clobber a curated lifecycle
        // classification (eventType/category) with the scraper's re-inferred
        // guess — those are set on first ingest and owned by reviewers
        // thereafter. Everything else (sources, cleaned copy, dates) still
        // refreshes so scraper improvements flow through.
        const {
          entryStatus: _dropStatus,
          eventType: _dropType,
          category: _dropCategory,
          ...updateData
        } = createData;
        await prisma.milestone.update({ where: { dedupeHash }, data: updateData });
        skipped++;
      } else {
        // New event — verify it (relevance + auto-approval) to set the review
        // gate instead of the blanket PENDING that normalizeMilestone applies.
        const verdict = await verifyEntry({
          name: data.name,
          description: data.description ?? "",
          category: data.category as string,
          sourceName: data.sourceName ?? "",
          significance: data.significance ?? 1,
          contractValue: data.contractValue ?? null,
          programSlug: program?.slug,
        });
        verdicts[verdict.status]++;
        console.log(
          `[ingest] ${verdict.status} (${verdict.method}) "${data.name.slice(0, 80)}" — ${verdict.reason}`,
        );
        await prisma.milestone.create({
          data: {
            ...createData,
            entryStatus: verdict.status,
            verifyReason: `${verdict.method}: ${verdict.reason}`,
          },
        });
        inserted++;

        // Push review-needed entries (PENDING) to Airtable as an extra review
        // surface. Best-effort: a failure/no-op never blocks or fails ingest —
        // the entry is already persisted in the DB with its verdict. No-ops
        // silently until the hardcoded Airtable config (lib/airtable.ts) is
        // filled in.
        if (verdict.status === "PENDING") {
          const sent = await postToAirtable({
            name: data.name,
            description: data.description ?? "",
            actor: data.actor ?? "Unknown",
            category: data.category as string,
            eventType: eventType ?? null,
            eventDate: data.eventDate ?? null,
            sourceName: data.sourceName ?? "",
            sourceUrl: data.sourceUrl ?? "",
            contractValue: data.contractValue ?? null,
            significance: data.significance ?? 1,
            entryStatus: verdict.status,
            verifyReason: `${verdict.method}: ${verdict.reason}`,
          });
          if (!sent.ok) {
            console.log(`[ingest] airtable post skipped/failed: ${sent.reason}`);
          }
        }
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
    verdicts,
    errors,
  });
}
