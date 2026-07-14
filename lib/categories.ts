/**
 * Category display metadata — labels + Tailwind color classes for all 12
 * Category enum values. Extends the legacy 5-color palette (legacy/style.css
 * --cat-*) to the full schema.
 *
 * Class strings are written as literals so Tailwind's JIT picks them up
 * (tailwind.config.ts `content` includes ./lib/**).
 */

export interface CategoryStyle {
  label: string;
  /** Accent text (eyebrow label, links). */
  text: string;
  /** Category pill: bg + text + border. */
  pill: string;
  /** Timeline spine dot + chart bar fill. */
  dot: string;
}

export const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  UNMANNED_SYSTEMS: {
    label: "Unmanned Systems",
    text: "text-emerald-600",
    pill: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    dot: "bg-emerald-500",
  },
  COMMAND_CONTROL: {
    label: "Command & Control",
    text: "text-blue-600",
    pill: "bg-blue-50 text-blue-700 border border-blue-200",
    dot: "bg-blue-500",
  },
  ISR: {
    label: "ISR",
    text: "text-cyan-600",
    pill: "bg-cyan-50 text-cyan-700 border border-cyan-200",
    dot: "bg-cyan-500",
  },
  LOGISTICS_SUSTAINMENT: {
    label: "Logistics & Sustainment",
    text: "text-amber-600",
    pill: "bg-amber-50 text-amber-700 border border-amber-200",
    dot: "bg-amber-500",
  },
  CYBER: {
    label: "Cyber & EW",
    text: "text-violet-600",
    pill: "bg-violet-50 text-violet-700 border border-violet-200",
    dot: "bg-violet-500",
  },
  TARGETING: {
    label: "Targeting",
    text: "text-rose-600",
    pill: "bg-rose-50 text-rose-700 border border-rose-200",
    dot: "bg-rose-500",
  },
  POLICY_DIRECTIVE: {
    label: "Policy / Directive",
    text: "text-slate-700",
    pill: "bg-slate-50 text-slate-700 border border-slate-200",
    dot: "bg-slate-500",
  },
  PROCUREMENT_CONTRACT: {
    label: "Procurement Contract",
    text: "text-teal-600",
    pill: "bg-teal-50 text-teal-700 border border-teal-200",
    dot: "bg-teal-500",
  },
  TRAINING_SIMULATION: {
    label: "Training & Simulation",
    text: "text-fuchsia-600",
    pill: "bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200",
    dot: "bg-fuchsia-500",
  },
  MEDICAL: {
    label: "Medical",
    text: "text-lime-600",
    pill: "bg-lime-50 text-lime-700 border border-lime-200",
    dot: "bg-lime-500",
  },
  SPACE: {
    label: "Space",
    text: "text-indigo-600",
    pill: "bg-indigo-50 text-indigo-700 border border-indigo-200",
    dot: "bg-indigo-500",
  },
  RESEARCH_DEVELOPMENT: {
    label: "Research & Development",
    text: "text-sky-600",
    pill: "bg-sky-50 text-sky-700 border border-sky-200",
    dot: "bg-sky-500",
  },
};

const FALLBACK: CategoryStyle = {
  label: "Other",
  text: "text-gray-700",
  pill: "bg-gray-50 text-gray-700 border border-gray-200",
  dot: "bg-gray-500",
};

export function categoryStyle(category: string): CategoryStyle {
  return CATEGORY_STYLES[category] ?? FALLBACK;
}

export function categoryLabel(category: string): string {
  return categoryStyle(category).label;
}
