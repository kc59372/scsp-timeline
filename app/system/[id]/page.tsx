import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchMilestone, type Milestone } from "@/lib/milestones";
import { categoryStyle, categoryLabel } from "@/lib/categories";
import { formatMilestoneDate, formatUsd } from "@/lib/format";

/** One row in the dates/details grid; renders nothing if value is empty. */
function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="border-t border-edge py-3">
      <dt className="font-mono text-[0.65rem] uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-200">{value}</dd>
    </div>
  );
}

export default async function SystemProfile({ params }: { params: { id: string } }) {
  const m: Milestone | null = await fetchMilestone(params.id);
  if (!m) notFound();

  const style = categoryStyle(m.category);
  const sources = [
    ...(m.sourceUrl ? [{ url: m.sourceUrl, label: m.sourceName ?? m.sourceUrl }] : []),
    ...m.additionalSources.map((url) => ({ url, label: url })),
  ];

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/timeline" className="font-mono text-xs text-gray-500 hover:text-blue-400">
        ← Back to timeline
      </Link>

      <div className="mt-6">
        <span className={`rounded px-2.5 py-1 font-mono text-[0.7rem] font-semibold uppercase tracking-wide ${style.pill}`}>
          {categoryLabel(m.category)}
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">{m.name}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-400">
          <span className="font-medium">{m.actor}</span>
          {m.systemStatus && (
            <>
              <span className="text-gray-600">·</span>
              <span className="font-mono text-xs uppercase text-gray-500">{m.systemStatus}</span>
            </>
          )}
          {m.subcategory && (
            <>
              <span className="text-gray-600">·</span>
              <span>{m.subcategory}</span>
            </>
          )}
        </div>
      </div>

      <p className="mt-6 leading-relaxed text-gray-200">{m.description}</p>

      {/* dates / details */}
      <section className="mt-10">
        <h2 className="mb-2 text-lg font-semibold">Adoption Profile</h2>
        <dl className="grid gap-x-8 sm:grid-cols-2">
          <Field label="Development Start" value={formatMilestoneDate(m.devStartDate)} />
          <Field label="Procurement" value={formatMilestoneDate(m.procurementDate)} />
          <Field label="Test" value={formatMilestoneDate(m.testDate)} />
          <Field label="Test Location" value={m.testLocation} />
          <Field label="Fielding" value={formatMilestoneDate(m.fieldingDate)} />
          <Field label="Deployment" value={formatMilestoneDate(m.deploymentDate)} />
          <Field label="Contract Number" value={m.contractNumber} />
          <Field label="Contract Value" value={formatUsd(m.contractValue)} />
          <Field label="Issuing Agency" value={m.issuingAgency} />
          <Field label="Awarded To" value={m.awardedTo} />
        </dl>
      </section>

      {/* tags */}
      {m.tags.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {m.tags.map((t) => (
            <span key={t.id} className="rounded-full border border-edge bg-panel px-3 py-1 text-xs text-gray-300">
              {t.name}
            </span>
          ))}
        </div>
      )}

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
