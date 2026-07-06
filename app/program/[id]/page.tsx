import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchProgram } from "@/lib/milestones";
import { categoryStyle, categoryLabel } from "@/lib/categories";
import { eventTypeLabel } from "@/lib/events";
import { orderEvents } from "@/lib/timeline";
import { formatMilestoneDate, primaryDateIso, formatUsd } from "@/lib/format";

export default async function ProgramProfile({ params }: { params: { id: string } }) {
  const program = await fetchProgram(params.id);
  if (!program) notFound();

  const style = categoryStyle(program.category);
  const events = orderEvents(program.events);

  // Aggregate unique sources across all lifecycle events.
  const sourceMap = new Map<string, string>();
  for (const e of events) {
    if (e.sourceUrl) sourceMap.set(e.sourceUrl, e.sourceName ?? e.sourceUrl);
    for (const url of e.additionalSources) if (!sourceMap.has(url)) sourceMap.set(url, url);
  }
  const sources = Array.from(sourceMap, ([url, label]) => ({ url, label }));

  const totalValue = events.reduce((sum, e) => sum + (e.contractValue ?? 0), 0);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/timeline" className="font-mono text-xs text-gray-500 hover:text-blue-400">
        ← Back to timeline
      </Link>

      <div className="mt-6">
        <div className="flex items-center gap-2">
          <span className={`rounded px-2.5 py-1 font-mono text-[0.7rem] font-semibold uppercase tracking-wide ${style.pill}`}>
            {categoryLabel(program.category)}
          </span>
          <span className="rounded bg-indigo-500/10 px-2 py-0.5 font-mono text-[0.7rem] uppercase tracking-wide text-indigo-300">
            Program
          </span>
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">{program.name}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-400">
          <span className="font-medium">{program.actor}</span>
          {program.systemStatus && (
            <>
              <span className="text-gray-600">·</span>
              <span className="font-mono text-xs uppercase text-gray-500">{program.systemStatus}</span>
            </>
          )}
          {program.subcategory && (
            <>
              <span className="text-gray-600">·</span>
              <span>{program.subcategory}</span>
            </>
          )}
        </div>
      </div>

      {program.description && <p className="mt-6 leading-relaxed text-gray-200">{program.description}</p>}

      {/* lifecycle track */}
      <section className="mt-10">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Adoption Lifecycle</h2>
          <span className="font-mono text-xs text-gray-500">
            {events.length} {events.length === 1 ? "stage" : "stages"}
            {totalValue > 0 && ` · ${formatUsd(totalValue)} total`}
          </span>
        </div>

        <ol className="relative flex flex-col gap-5 pl-6 before:absolute before:bottom-2 before:left-[3px] before:top-2 before:w-0.5 before:bg-edge">
          {events.map((e) => (
            <li key={e.id} className="relative">
              <span className={`absolute -left-6 top-1.5 h-2.5 w-2.5 -translate-x-[3px] rounded-full border-2 border-ink ${style.dot}`} />
              <div className="rounded-lg border border-edge bg-panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`font-mono text-[0.7rem] font-bold uppercase tracking-wide ${style.text}`}>
                    {eventTypeLabel(e.eventType)}
                  </span>
                  <span className="font-mono text-xs text-gray-500">
                    {formatMilestoneDate(primaryDateIso(e)) ?? "date unknown"}
                  </span>
                </div>
                <h3 className="mt-1 font-semibold text-gray-100">
                  <Link href={`/system/${e.id}`} className="hover:text-blue-400 hover:underline">
                    {e.name}
                  </Link>
                </h3>
                {e.description && <p className="mt-2 text-sm leading-relaxed text-gray-400">{e.description}</p>}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[0.7rem] text-gray-500">
                  {e.contractNumber && <span>Contract {e.contractNumber}</span>}
                  {e.contractValue != null && <span>{formatUsd(e.contractValue)}</span>}
                  {e.awardedTo && <span>Awarded to {e.awardedTo}</span>}
                  {e.testLocation && <span>Location: {e.testLocation}</span>}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* sources */}
      {sources.length > 0 && (
        <section className="mt-10 rounded-md border border-edge bg-black/30 p-4">
          <div className="mb-3 font-mono text-[0.7rem] font-bold uppercase tracking-wide text-gray-500">
            Verified Public Sources
          </div>
          <ul className="flex flex-col gap-2">
            {sources.map((s) => (
              <li key={s.url}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 hover:underline"
                >
                  <span className="break-all">{s.label}</span>
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="shrink-0">
                    <path d="M3.5 1.5H10.5M10.5 1.5V8.5M10.5 1.5L1.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
