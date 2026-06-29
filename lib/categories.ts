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
    text: "text-emerald-400",
    pill: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30",
    dot: "bg-emerald-400",
  },
  COMMAND_CONTROL: {
    label: "Command & Control",
    text: "text-blue-400",
    pill: "bg-blue-500/10 text-blue-300 border border-blue-500/30",
    dot: "bg-blue-400",
  },
  ISR: {
    label: "ISR",
    text: "text-cyan-400",
    pill: "bg-cyan-500/10 text-cyan-300 border border-cyan-500/30",
    dot: "bg-cyan-400",
  },
  LOGISTICS_SUSTAINMENT: {
    label: "Logistics & Sustainment",
    text: "text-amber-400",
    pill: "bg-amber-500/10 text-amber-300 border border-amber-500/30",
    dot: "bg-amber-400",
  },
  CYBER: {
    label: "Cyber & EW",
    text: "text-violet-400",
    pill: "bg-violet-500/10 text-violet-300 border border-violet-500/30",
    dot: "bg-violet-400",
  },
  TARGETING: {
    label: "Targeting",
    text: "text-rose-400",
    pill: "bg-rose-500/10 text-rose-300 border border-rose-500/30",
    dot: "bg-rose-400",
  },
  POLICY_DIRECTIVE: {
    label: "Policy / Directive",
    text: "text-slate-300",
    pill: "bg-slate-500/10 text-slate-300 border border-slate-500/30",
    dot: "bg-slate-400",
  },
  PROCUREMENT_CONTRACT: {
    label: "Procurement Contract",
    text: "text-teal-400",
    pill: "bg-teal-500/10 text-teal-300 border border-teal-500/30",
    dot: "bg-teal-400",
  },
  TRAINING_SIMULATION: {
    label: "Training & Simulation",
    text: "text-fuchsia-400",
    pill: "bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-500/30",
    dot: "bg-fuchsia-400",
  },
  MEDICAL: {
    label: "Medical",
    text: "text-lime-400",
    pill: "bg-lime-500/10 text-lime-300 border border-lime-500/30",
    dot: "bg-lime-400",
  },
  SPACE: {
    label: "Space",
    text: "text-indigo-400",
    pill: "bg-indigo-500/10 text-indigo-300 border border-indigo-500/30",
    dot: "bg-indigo-400",
  },
  RESEARCH_DEVELOPMENT: {
    label: "Research & Development",
    text: "text-sky-400",
    pill: "bg-sky-500/10 text-sky-300 border border-sky-500/30",
    dot: "bg-sky-400",
  },
};

const FALLBACK: CategoryStyle = {
  label: "Other",
  text: "text-gray-300",
  pill: "bg-gray-500/10 text-gray-300 border border-gray-500/30",
  dot: "bg-gray-400",
};

export function categoryStyle(category: string): CategoryStyle {
  return CATEGORY_STYLES[category] ?? FALLBACK;
}

export function categoryLabel(category: string): string {
  return categoryStyle(category).label;
}
