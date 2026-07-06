/**
 * /api/milestones/[id]
 *
 * GET   — public returns the milestone only if APPROVED; an authenticated admin
 *         gets it regardless of status (so the edit page can load PENDING ones).
 * PATCH — admin-only partial update. Accepts any editable field (incl. all
 *         dates, additionalSources[], entryStatus, reviewNote). Used for edits
 *         and for approve/reject (just send entryStatus [+ reviewNote]).
 */
import { NextRequest, NextResponse } from "next/server";
import { Prisma, Category, SystemStatus, EntryStatus, EventType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

const CATEGORY_VALUES = new Set(Object.values(Category));
const SYSTEM_STATUS_VALUES = new Set(Object.values(SystemStatus));
const ENTRY_STATUS_VALUES = new Set(Object.values(EntryStatus));
const EVENT_TYPE_VALUES = new Set(Object.values(EventType));
const DATE_FIELDS = ["devStartDate", "procurementDate", "testDate", "fieldingDate", "deploymentDate", "eventDate"] as const;
// Required (non-null) string columns — only updated when given a string.
const REQUIRED_STRING_FIELDS = ["name", "description", "actor"] as const;
// Nullable string columns — may be set to null/"".
const NULLABLE_STRING_FIELDS = [
  "subcategory", "testLocation", "sourceUrl", "sourceName",
  "contractNumber", "issuingAgency", "awardedTo", "reviewNote",
] as const;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  const where: Prisma.MilestoneWhereInput = session
    ? { id: params.id }
    : { id: params.id, entryStatus: "APPROVED" };

  const milestone = await prisma.milestone.findFirst({ where, include: { tags: true, program: true } });
  if (!milestone) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(milestone);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const data: Prisma.MilestoneUpdateInput = {};

  for (const f of REQUIRED_STRING_FIELDS) {
    if (f in body) {
      const v = body[f];
      if (typeof v !== "string" || v.trim() === "") {
        return NextResponse.json({ error: `${f} must be a non-empty string` }, { status: 400 });
      }
      data[f] = v;
    }
  }

  for (const f of NULLABLE_STRING_FIELDS) {
    if (f in body) {
      const v = body[f];
      if (v === null || v === "") data[f] = null;
      else if (typeof v === "string") data[f] = v;
      else return NextResponse.json({ error: `${f} must be a string or null` }, { status: 400 });
    }
  }

  for (const f of DATE_FIELDS) {
    if (f in body) {
      const v = body[f];
      if (v === null || v === "") {
        data[f] = null;
      } else if (typeof v === "string") {
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) {
          return NextResponse.json({ error: `invalid date for ${f}` }, { status: 400 });
        }
        data[f] = d;
      } else {
        return NextResponse.json({ error: `${f} must be a date string or null` }, { status: 400 });
      }
    }
  }

  if ("category" in body) {
    if (!CATEGORY_VALUES.has(body.category as Category)) {
      return NextResponse.json({ error: `invalid category: ${body.category}` }, { status: 400 });
    }
    data.category = body.category as Category;
  }
  if ("systemStatus" in body) {
    const v = body.systemStatus;
    if (v === null || v === "") data.systemStatus = null;
    else if (SYSTEM_STATUS_VALUES.has(v as SystemStatus)) data.systemStatus = v as SystemStatus;
    else return NextResponse.json({ error: `invalid systemStatus: ${v}` }, { status: 400 });
  }
  if ("entryStatus" in body) {
    if (!ENTRY_STATUS_VALUES.has(body.entryStatus as EntryStatus)) {
      return NextResponse.json({ error: `invalid entryStatus: ${body.entryStatus}` }, { status: 400 });
    }
    data.entryStatus = body.entryStatus as EntryStatus;
  }
  if ("eventType" in body) {
    const v = body.eventType;
    if (v === null || v === "") data.eventType = null;
    else if (EVENT_TYPE_VALUES.has(v as EventType)) data.eventType = v as EventType;
    else return NextResponse.json({ error: `invalid eventType: ${v}` }, { status: 400 });
  }
  if ("programId" in body) {
    const v = body.programId;
    if (v === null || v === "") data.program = { disconnect: true };
    else if (typeof v === "string") data.program = { connect: { id: v } };
    else return NextResponse.json({ error: "programId must be a string or null" }, { status: 400 });
  }
  if ("additionalSources" in body) {
    if (!Array.isArray(body.additionalSources) || body.additionalSources.some((x) => typeof x !== "string")) {
      return NextResponse.json({ error: "additionalSources must be a string[]" }, { status: 400 });
    }
    data.additionalSources = body.additionalSources as string[];
  }
  if ("contractValue" in body) {
    const v = body.contractValue;
    if (v === null || v === "") data.contractValue = null;
    else {
      const n = Number(v);
      if (Number.isNaN(n)) return NextResponse.json({ error: "invalid contractValue" }, { status: 400 });
      data.contractValue = n;
    }
  }
  if ("significance" in body) {
    const n = Number(body.significance);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      return NextResponse.json({ error: "significance must be an integer 1–5" }, { status: 400 });
    }
    data.significance = n;
  }

  try {
    const updated = await prisma.milestone.update({
      where: { id: params.id },
      data,
      include: { tags: true, program: true },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
