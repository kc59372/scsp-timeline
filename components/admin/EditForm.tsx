"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Milestone } from "@/lib/milestones";
import { CATEGORY_STYLES } from "@/lib/categories";
import { EVENT_TYPES, eventTypeLabel } from "@/lib/events";

const SYSTEM_STATUSES = ["", "DEVELOPMENT", "TESTING", "FIELDED", "CANCELLED", "UNKNOWN"];
const DATE_FIELDS: { key: keyof Milestone; label: string }[] = [
  { key: "devStartDate", label: "Dev Start" },
  { key: "procurementDate", label: "Procurement" },
  { key: "testDate", label: "Test" },
  { key: "fieldingDate", label: "Fielding" },
  { key: "deploymentDate", label: "Deployment" },
];

/** ISO datetime → yyyy-mm-dd for <input type="date">. */
function toDateInput(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

export function EditForm({ milestone }: { milestone: Milestone }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: milestone.name,
    description: milestone.description,
    actor: milestone.actor,
    category: milestone.category,
    subcategory: milestone.subcategory ?? "",
    systemStatus: milestone.systemStatus ?? "",
    eventType: milestone.eventType ?? "",
    eventDate: toDateInput(milestone.eventDate),
    devStartDate: toDateInput(milestone.devStartDate),
    procurementDate: toDateInput(milestone.procurementDate),
    testDate: toDateInput(milestone.testDate),
    fieldingDate: toDateInput(milestone.fieldingDate),
    deploymentDate: toDateInput(milestone.deploymentDate),
    testLocation: milestone.testLocation ?? "",
    sourceUrl: milestone.sourceUrl ?? "",
    sourceName: milestone.sourceName ?? "",
    contractNumber: milestone.contractNumber ?? "",
    contractValue: milestone.contractValue?.toString() ?? "",
    issuingAgency: milestone.issuingAgency ?? "",
    awardedTo: milestone.awardedTo ?? "",
    significance: milestone.significance,
    reviewNote: milestone.reviewNote ?? "",
  });
  const [sources, setSources] = useState<string[]>(milestone.additionalSources);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function buildBody(entryStatus: "APPROVED" | "REJECTED") {
    return {
      ...form,
      contractValue: form.contractValue === "" ? null : Number(form.contractValue),
      significance: Number(form.significance),
      additionalSources: sources.filter((s) => s.trim() !== ""),
      entryStatus,
    };
  }

  async function submit(entryStatus: "APPROVED" | "REJECTED") {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/milestones/${milestone.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildBody(entryStatus)),
    });
    setBusy(false);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      setMsg(`Error: ${e.error ?? res.status}`);
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  const input = "rounded-md border border-edge bg-panel px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500";
  const labelCls = "font-mono text-[0.65rem] uppercase tracking-wide text-gray-500";

  return (
    <form className="mt-8 flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
      <label className="flex flex-col gap-1">
        <span className={labelCls}>Name</span>
        <input className={input} value={form.name} onChange={(e) => set("name", e.target.value)} />
      </label>

      <label className="flex flex-col gap-1">
        <span className={labelCls}>Description</span>
        <textarea className={`${input} min-h-28`} value={form.description} onChange={(e) => set("description", e.target.value)} />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Actor</span>
          <input className={input} value={form.actor} onChange={(e) => set("actor", e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Category</span>
          <select className={input} value={form.category} onChange={(e) => set("category", e.target.value)}>
            {Object.keys(CATEGORY_STYLES).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Subcategory</span>
          <input className={input} value={form.subcategory} onChange={(e) => set("subcategory", e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>System Status</span>
          <select className={input} value={form.systemStatus} onChange={(e) => set("systemStatus", e.target.value)}>
            {SYSTEM_STATUSES.map((s) => <option key={s} value={s}>{s || "—"}</option>)}
          </select>
        </label>
      </div>

      {/* Lifecycle grouping — merge into a program from the review queue. */}
      <div className="grid gap-5 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <span className={labelCls}>Program</span>
          <div className="rounded-md border border-edge bg-panel/60 px-3 py-2 text-sm text-gray-300">
            {milestone.program ? (
              milestone.program.name
            ) : (
              <span className="text-gray-500">Ungrouped — use “Merge” in the queue</span>
            )}
          </div>
        </div>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Event Type</span>
          <select className={input} value={form.eventType} onChange={(e) => set("eventType", e.target.value)}>
            <option value="">—</option>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>{eventTypeLabel(t)}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Event Date</span>
          <input type="date" className={input} value={form.eventDate} onChange={(e) => set("eventDate", e.target.value)} />
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        {DATE_FIELDS.map(({ key, label }) => (
          <label key={key} className="flex flex-col gap-1">
            <span className={labelCls}>{label}</span>
            <input
              type="date"
              className={input}
              value={form[key as keyof typeof form] as string}
              onChange={(e) => set(key as keyof typeof form, e.target.value as never)}
            />
          </label>
        ))}
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Test Location</span>
          <input className={input} value={form.testLocation} onChange={(e) => set("testLocation", e.target.value)} />
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Source Name</span>
          <input className={input} value={form.sourceName} onChange={(e) => set("sourceName", e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Source URL</span>
          <input className={input} value={form.sourceUrl} onChange={(e) => set("sourceUrl", e.target.value)} />
        </label>
      </div>

      {/* additionalSources dynamic list */}
      <div className="flex flex-col gap-2">
        <span className={labelCls}>Additional Sources</span>
        {sources.map((s, i) => (
          <div key={i} className="flex gap-2">
            <input
              className={`${input} flex-1`}
              value={s}
              onChange={(e) => setSources((arr) => arr.map((v, j) => (j === i ? e.target.value : v)))}
            />
            <button
              type="button"
              onClick={() => setSources((arr) => arr.filter((_, j) => j !== i))}
              className="rounded-md border border-edge px-3 text-sm text-rose-400 hover:border-rose-500"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setSources((arr) => [...arr, ""])}
          className="self-start rounded-md border border-edge px-3 py-1.5 text-xs text-gray-300 hover:border-gray-500"
        >
          + Add source
        </button>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Contract Number</span>
          <input className={input} value={form.contractNumber} onChange={(e) => set("contractNumber", e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Contract Value (raw USD)</span>
          <input className={input} value={form.contractValue} onChange={(e) => set("contractValue", e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Issuing Agency</span>
          <input className={input} value={form.issuingAgency} onChange={(e) => set("issuingAgency", e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Awarded To</span>
          <input className={input} value={form.awardedTo} onChange={(e) => set("awardedTo", e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Significance (1–5)</span>
          <input type="number" min={1} max={5} className={input} value={form.significance} onChange={(e) => set("significance", Number(e.target.value))} />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className={labelCls}>Review Note (optional)</span>
        <textarea className={input} value={form.reviewNote} onChange={(e) => set("reviewNote", e.target.value)} placeholder="e.g. reason for rejection" />
      </label>

      {msg && <p className="text-sm text-rose-400">{msg}</p>}

      <div className="flex gap-3 border-t border-edge pt-5">
        <button onClick={() => submit("APPROVED")} disabled={busy} className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
          Save & Approve
        </button>
        <button onClick={() => submit("REJECTED")} disabled={busy} className="rounded-md bg-rose-600 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50">
          Reject
        </button>
      </div>
    </form>
  );
}
