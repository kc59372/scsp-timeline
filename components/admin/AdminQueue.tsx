"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Milestone } from "@/lib/milestones";
import { categoryLabel } from "@/lib/categories";
import { formatMilestoneDate } from "@/lib/format";

/** Pending review queue with bulk + per-row approve/reject/edit. */
export function AdminQueue({ items }: { items: Milestone[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const allSelected = items.length > 0 && selected.size === items.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(items.map((m) => m.id)));
  }

  async function review(id: string, action: "approve" | "reject") {
    setBusy(true);
    await fetch(`/api/milestones/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryStatus: action === "approve" ? "APPROVED" : "REJECTED" }),
    });
    setBusy(false);
    router.refresh();
  }

  async function bulk(action: "approve" | "reject") {
    if (selected.size === 0) return;
    setBusy(true);
    await fetch(`/api/milestones/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected), action }),
    });
    setSelected(new Set());
    setBusy(false);
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-edge bg-panel p-10 text-center text-sm text-gray-400">
        No pending entries. The review queue is clear.
      </div>
    );
  }

  return (
    <div>
      {/* bulk action bar */}
      <div className="mb-3 flex items-center gap-3">
        <span className="text-sm text-gray-400">{selected.size} selected</span>
        <button
          onClick={() => bulk("approve")}
          disabled={busy || selected.size === 0}
          className="rounded-md bg-emerald-600/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-40"
        >
          Approve selected
        </button>
        <button
          onClick={() => bulk("reject")}
          disabled={busy || selected.size === 0}
          className="rounded-md bg-rose-600/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600 disabled:opacity-40"
        >
          Reject selected
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-edge">
        <table className="w-full text-left text-sm">
          <thead className="bg-panel font-mono text-[0.65rem] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="p-3"><input type="checkbox" checked={allSelected} onChange={toggleAll} /></th>
              <th className="p-3">Name</th>
              <th className="p-3">Category</th>
              <th className="p-3">Actor</th>
              <th className="p-3">Dev Start</th>
              <th className="p-3">Deployment</th>
              <th className="p-3">Source</th>
              <th className="p-3">Scraped</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge">
            {items.map((m) => (
              <tr key={m.id} className="align-top hover:bg-panel/50">
                <td className="p-3">
                  <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggle(m.id)} />
                </td>
                <td className="p-3 font-medium text-gray-100">{m.name}</td>
                <td className="p-3 text-gray-400">{categoryLabel(m.category)}</td>
                <td className="p-3 text-gray-400">{m.actor}</td>
                <td className="p-3 font-mono text-xs text-gray-500">{formatMilestoneDate(m.devStartDate) ?? "—"}</td>
                <td className="p-3 font-mono text-xs text-gray-500">{formatMilestoneDate(m.deploymentDate) ?? "—"}</td>
                <td className="p-3 text-xs">
                  {m.sourceUrl ? (
                    <a href={m.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                      {m.sourceName ?? "source"}
                    </a>
                  ) : (
                    <span className="text-gray-600">{m.sourceName ?? "—"}</span>
                  )}
                </td>
                <td className="p-3 font-mono text-xs text-gray-500">
                  {new Date(m.createdAt).toISOString().slice(0, 10)}
                </td>
                <td className="p-3">
                  <div className="flex gap-2 whitespace-nowrap">
                    <button onClick={() => review(m.id, "approve")} disabled={busy} className="text-xs font-semibold text-emerald-400 hover:underline disabled:opacity-40">Approve</button>
                    <Link href={`/admin/${m.id}/edit`} className="text-xs font-semibold text-blue-400 hover:underline">Edit</Link>
                    <button onClick={() => review(m.id, "reject")} disabled={busy} className="text-xs font-semibold text-rose-400 hover:underline disabled:opacity-40">Reject</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
