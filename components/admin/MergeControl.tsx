"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Program } from "@/lib/milestones";
import { CATEGORY_STYLES } from "@/lib/categories";

/**
 * Merge the selected events into one Program — either an existing program or a
 * brand-new one. Used from the admin review queue so reviewers can group a
 * solicitation + award + test + deployment under a single lifecycle.
 */
export function MergeControl({
  selectedIds,
  onDone,
}: {
  selectedIds: string[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [programId, setProgramId] = useState("");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("PROCUREMENT_CONTRACT");
  const [newActor, setNewActor] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Load merge-target programs once.
  useEffect(() => {
    fetch("/api/programs", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => {
        setPrograms(d.items ?? []);
        if ((d.items ?? []).length === 0) setMode("new");
      })
      .catch(() => setPrograms([]));
  }, []);

  const disabled = selectedIds.length === 0;

  async function merge() {
    setBusy(true);
    setMsg(null);
    const body: Record<string, unknown> = { ids: selectedIds };
    if (mode === "existing") {
      if (!programId) {
        setMsg("Pick a program to merge into.");
        setBusy(false);
        return;
      }
      body.programId = programId;
    } else {
      if (!newName.trim()) {
        setMsg("New program needs a name.");
        setBusy(false);
        return;
      }
      body.newProgram = { name: newName.trim(), category: newCategory, actor: newActor.trim() || undefined };
    }

    const res = await fetch("/api/milestones/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      setMsg(`Error: ${e.error ?? res.status}`);
      return;
    }
    setNewName("");
    setProgramId("");
    onDone();
    router.refresh();
  }

  const input =
    "rounded-md border border-edge bg-panel px-3 py-1.5 text-xs text-ink outline-none focus:border-accent";

  return (
    <div className="rounded-md border border-edge bg-panel/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[0.65rem] uppercase tracking-wide text-gray-500">
          Merge {selectedIds.length} into program
        </span>

        <div className="flex overflow-hidden rounded-md border border-edge text-xs">
          <button
            type="button"
            onClick={() => setMode("existing")}
            disabled={programs.length === 0}
            className={`px-2 py-1 ${mode === "existing" ? "bg-accent text-white" : "text-gray-600"} disabled:opacity-40`}
          >
            Existing
          </button>
          <button
            type="button"
            onClick={() => setMode("new")}
            className={`px-2 py-1 ${mode === "new" ? "bg-accent text-white" : "text-gray-600"}`}
          >
            New
          </button>
        </div>

        {mode === "existing" ? (
          <select className={input} value={programId} onChange={(e) => setProgramId(e.target.value)}>
            <option value="">Select program…</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p._count?.events ?? 0})
              </option>
            ))}
          </select>
        ) : (
          <>
            <input
              className={input}
              placeholder="New program name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              className={input}
              placeholder="Actor (e.g. Palantir / DoD)"
              value={newActor}
              onChange={(e) => setNewActor(e.target.value)}
            />
            <select className={input} value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
              {Object.entries(CATEGORY_STYLES).map(([key, s]) => (
                <option key={key} value={key}>
                  {s.label}
                </option>
              ))}
            </select>
          </>
        )}

        <button
          type="button"
          onClick={merge}
          disabled={busy || disabled}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-dark disabled:opacity-40"
        >
          Merge
        </button>
      </div>
      {msg && <p className="mt-2 text-xs text-rose-400">{msg}</p>}
    </div>
  );
}
