import { SiteSidebar } from "@/components/SiteSidebar";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata = {
  title: "Comparison Tool — US Military AI Adoption",
};

export default function ComparePage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-7xl flex-col gap-10 px-6 py-12 lg:flex-row lg:items-start lg:gap-12">
      {/* ── Persistent site sidebar ── */}
      <SiteSidebar />

      {/* ── Main column: placeholder ── */}
      <div className="min-w-0 flex-1">
        <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-lg border border-dashed border-edge bg-panel p-12 text-center">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-signal">
            Coming Soon
          </span>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-ink">
            Comparison tool is in the works
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-gray-600">
            We&apos;re building a way to compare programs, categories, and adoption
            trends side by side. Check back soon.
          </p>
        </div>
      </div>
      </main>
    </>
  );
}
