import { fetchMilestones } from "@/lib/milestones";
import { TimelineExplorer } from "@/components/TimelineExplorer";

export const metadata = {
  title: "Timeline — US Military AI Adoption",
};

export default async function TimelinePage() {
  const { items } = await fetchMilestones();

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">
        Full Timeline
      </p>
      <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
        US Military AI Adoption, 2016–2026
      </h1>
      <p className="mt-4 max-w-2xl text-gray-400">
        Filter by category and year. Click any entry for details and verified
        sources, or open its full adoption profile.
      </p>
      <TimelineExplorer initialData={items} />
    </main>
  );
}
