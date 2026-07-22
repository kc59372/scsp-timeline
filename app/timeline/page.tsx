import { loadMilestones } from "@/lib/pageData";
import { TimelineExplorer } from "@/components/TimelineExplorer";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata = {
  title: "Timeline — US Military AI Adoption",
};

export default async function TimelinePage() {
  // Every approved milestone (uncapped) so the timeline renders the full set and
  // its counts match the header total. The `?q=` deep link is hydrated client-
  // side in TimelineExplorer, so this page needs no request-time searchParams —
  // which also lets it pre-render as flat HTML in the static export.
  const { items, total } = await loadMilestones({ pageSize: "all" });

  return (
    <>
      <SiteHeader total={total} />
      <main className="mx-auto max-w-7xl px-6 py-12">
        <TimelineExplorer initialData={items} />
      </main>
    </>
  );
}
