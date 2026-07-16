import Link from "next/link";
import { fetchMilestones } from "@/lib/milestones";

/**
 * Full-width title banner across the top of every page. `total` shows the
 * verified-milestone count; pages that already fetched milestones pass it to
 * avoid a second query, otherwise the header fetches the count itself.
 */
export async function SiteHeader({ total }: { total?: number }) {
  const count = total ?? (await fetchMilestones()).total;

  return (
    <header className="border-b border-edge bg-paper">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">
          US Military AI Adoption · 2016–2026
        </p>
        <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          <Link href="/" className="hover:text-accent">
            US Military AI Adoption Timeline
          </Link>
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-600">
          Tracking US military AI milestones — fielded systems, policy directives,
          and technology developments — for policymakers and developers.{" "}
          <span className="font-mono text-xs text-gray-500">
            {count} verified milestones and counting.
          </span>
        </p>
      </div>
    </header>
  );
}
