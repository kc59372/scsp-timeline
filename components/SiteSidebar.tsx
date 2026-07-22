"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

const NAV = [
  { href: "/", label: "Home", hint: "Overview (updated with quarterly summaries), recent events, and major projects" },
  { href: "/timeline", label: "Full Timeline", hint: "Filter & explore every milestone" },
  { href: "/compare", label: "Comparison Tool", hint: "Compare programs side by side" },
] as const;

/**
 * Search box that lives in every sidebar. On the timeline it's *controlled*
 * (wired to the live filter state via `onControlledChange`, so it filters in
 * place). On other pages it's uncontrolled and submitting jumps to the timeline
 * with the query pre-applied.
 */
function SidebarSearch({
  controlledValue,
  onControlledChange,
}: {
  controlledValue?: string;
  onControlledChange?: (v: string) => void;
}) {
  const router = useRouter();
  const controlled = onControlledChange != null;
  const [local, setLocal] = useState("");
  const value = controlled ? controlledValue ?? "" : local;

  const setValue = (v: string) => (controlled ? onControlledChange!(v) : setLocal(v));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (controlled) return; // filters in place — no navigation
    const q = local.trim();
    router.push(q ? `/timeline?q=${encodeURIComponent(q)}` : "/timeline");
  }

  return (
    <form onSubmit={onSubmit} role="search">
      <label
        htmlFor="sidebar-search"
        className="mb-3 block font-mono text-xs uppercase tracking-[0.1em] text-gray-500"
      >
        Search
      </label>
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          aria-hidden="true"
        >
          <circle cx="9" cy="9" r="6" />
          <path d="m14 14 3.5 3.5" strokeLinecap="round" />
        </svg>
        <input
          id="sidebar-search"
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Name, org, contract…"
          className="w-full rounded-lg border border-edge bg-panel py-2 pl-9 pr-8 text-sm text-ink placeholder:text-gray-500 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        {value && (
          <button
            type="button"
            onClick={() => setValue("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-gray-500 hover:bg-raise hover:text-ink"
          >
            ×
          </button>
        )}
      </div>
    </form>
  );
}

/**
 * The site's persistent left sidebar — identical search, scope note, and nav on
 * every page (the title lives in the top-of-page SiteHeader). On the timeline,
 * `search`/`onSearchChange` wire the sidebar search to the live filter state;
 * `children` renders any extra page-specific controls.
 */
export function SiteSidebar({
  children,
  search,
  onSearchChange,
}: {
  children?: ReactNode;
  search?: string;
  onSearchChange?: (v: string) => void;
}) {
  const pathname = usePathname();

  return (
    <aside className="lg:sticky lg:top-12 lg:max-h-[calc(100vh-3rem)] lg:w-80 lg:shrink-0 lg:overflow-y-auto">
      {/* Search — present in every sidebar */}
      <SidebarSearch controlledValue={search} onControlledChange={onSearchChange} />

      {/* Scope note */}
      <section className="mt-8 rounded-lg border border-edge bg-panel p-5">
        <h2 className="font-mono text-xs uppercase tracking-[0.1em] text-signal">
          Scope Note
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          This tracker draws on US military contracts and press releases from
          open-source, publicly available records. It is a curated snapshot —{" "}
          <span className="font-medium text-ink">not a comprehensive index</span>{" "}
          of all US military AI activity.
        </p>
      </section>

      {/* Nav */}
      <nav className="mt-6 flex flex-col gap-3">
        {NAV.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`group flex items-center justify-between rounded-lg border px-5 py-4 transition-colors ${
                isActive
                  ? "border-transparent bg-ink text-white hover:bg-brand"
                  : "border-edge bg-panel text-ink hover:border-accent/40 hover:bg-raise"
              }`}
            >
              <span>
                <span className="block text-sm font-semibold">{item.label}</span>
                <span
                  className={`block font-mono text-[0.7rem] ${
                    isActive ? "text-white/70" : "text-gray-500"
                  }`}
                >
                  {item.hint}
                </span>
              </span>
              <span className="font-mono text-lg transition-transform group-hover:translate-x-1">
                →
              </span>
            </Link>
          );
        })}
      </nav>

      {children}
    </aside>
  );
}
