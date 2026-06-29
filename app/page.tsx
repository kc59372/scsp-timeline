import Link from "next/link";
import { fetchMilestones } from "@/lib/milestones";
import { AdoptionVelocityChart } from "@/components/AdoptionVelocityChart";
import { MilestoneCard } from "@/components/MilestoneCard";

export default async function Home() {
  const { items, total } = await fetchMilestones();
  const featured = items
    .filter((m) => m.significance >= 4)
    .sort((a, b) => b.significance - a.significance)
    .slice(0, 4);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      {/* hero */}
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">
        US Military AI Adoption · 2016–2026
      </p>
      <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
        US Military AI Adoption Timeline
      </h1>
      <p className="mt-6 max-w-2xl text-lg text-gray-400">
        An interactive tracker of US military AI milestones — procurement
        contracts, fielded systems, policy directives, and technology
        developments — built for policymakers and developers. {total} verified
        milestones and counting.
      </p>
      <div className="mt-8">
        <Link
          href="/timeline"
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
        >
          Explore the full timeline
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>

      {/* velocity chart above the fold */}
      <div className="mt-12">
        <AdoptionVelocityChart milestones={items} />
      </div>

      {/* featured */}
      {featured.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-1 text-xl font-semibold">Significant Milestones</h2>
          <p className="mb-6 text-sm text-gray-400">
            High-impact entries across the adoption timeline.
          </p>
          <div className="flex flex-col gap-6">
            {featured.map((m) => (
              <MilestoneCard key={m.id} milestone={m} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
