import { fetchMilestones } from "@/lib/milestones";
import { TimelineExplorer } from "@/components/TimelineExplorer";

export const metadata = {
  title: "Timeline — US Military AI Adoption",
};

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const { items, total } = await fetchMilestones();
  const initialSearch = typeof searchParams.q === "string" ? searchParams.q : "";

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <TimelineExplorer initialData={items} total={total} initialSearch={initialSearch} />
    </main>
  );
}
