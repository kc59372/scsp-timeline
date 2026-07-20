import { fetchMilestones } from "@/lib/milestones";
import { TimelineExplorer } from "@/components/TimelineExplorer";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata = {
  title: "Timeline — US Military AI Adoption",
};

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  // Fetch every approved milestone (uncapped) so the timeline renders the full
  // set and its counts match the header's DB-wide total.
  const { items, total } = await fetchMilestones({ pageSize: "all" });
  const initialSearch = typeof searchParams.q === "string" ? searchParams.q : "";

  return (
    <>
      <SiteHeader total={total} />
      <main className="mx-auto max-w-7xl px-6 py-12">
        <TimelineExplorer initialData={items} initialSearch={initialSearch} />
      </main>
    </>
  );
}
