import { fetchMilestones } from "@/lib/milestones";
import { TimelineExplorer } from "@/components/TimelineExplorer";

export const metadata = {
  title: "Timeline — US Military AI Adoption",
};

export default async function TimelinePage() {
  const { items, total } = await fetchMilestones();

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      {/* hero */}
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">
        US Military AI Adoption · 2016–2026
      </p>
      <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
        US Military AI Adoption Timeline
      </h1>
      <p className="mt-6 max-w-2xl text-lg text-gray-600">
        An interactive tracker of US military AI milestones: fielded systems,
        policy directives, and technology developments. Built for policymakers
        and developers. {total} verified milestones and counting.
      </p>
      <TimelineExplorer initialData={items} />
    </main>
  );
}
