/**
 * Category display metadata — label + a single accent hex per Category enum
 * value. Styling is applied via inline `style` objects (not Tailwind classes)
 * so the exact brand hexes render regardless of Tailwind's JIT palette.
 *
 * Palette: 8 curated brand hexes assigned to the most prominent categories,
 * plus 4 harmonious muted tones (targeting/medical/unmanned/training) drawn in
 * the same desaturated register to cover the full 12-value schema.
 */

import type { CSSProperties } from "react";

export interface CategoryStyle {
  label: string;
  /** Accent hex for this category. */
  color: string;
}

export const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  COMMAND_CONTROL: { label: "Command & Control", color: "#1658AF" },
  CYBER: { label: "Cyber & EW", color: "#662973" },
  ISR: { label: "ISR", color: "#0F7173" },
  LOGISTICS_SUSTAINMENT: { label: "Logistics & Sustainment", color: "#DA7447" },
  MEDICAL: { label: "Medical", color: "#2F7D5F" },
  POLICY_DIRECTIVE: { label: "Policy / Directive", color: "#7B7B7B" },
  PROCUREMENT_CONTRACT: { label: "Procurement Contract", color: "#436829" },
  RESEARCH_DEVELOPMENT: { label: "Research & Development", color: "#B5527D" },
  SPACE: { label: "Space", color: "#8397D2" },
  TARGETING: { label: "Targeting", color: "#A6392E" },
  TRAINING_SIMULATION: { label: "Training & Simulation", color: "#B07D2B" },
  UNMANNED_SYSTEMS: { label: "Unmanned Systems", color: "#4A6C8C" },
};

const FALLBACK: CategoryStyle = { label: "Other", color: "#7B7B7B" };

export function categoryStyle(category: string): CategoryStyle {
  return CATEGORY_STYLES[category] ?? FALLBACK;
}

export function categoryLabel(category: string): string {
  return categoryStyle(category).label;
}

export function categoryColor(category: string): string {
  return categoryStyle(category).color;
}

/** Append an alpha byte (0–1) to a #rrggbb hex → #rrggbbaa. */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}

/** Relative luminance of a #rrggbb hex, for choosing legible foreground text. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** Legible text color (near-black vs white) to sit on top of a solid category fill. */
export function categoryFg(category: string): string {
  return luminance(categoryColor(category)) > 0.55 ? "#1a1a1a" : "#ffffff";
}

/** Tinted pill: colored text on a faint category-tinted background + border. */
export function pillStyle(category: string): CSSProperties {
  const c = categoryColor(category);
  return { color: c, backgroundColor: withAlpha(c, 0.12), borderColor: withAlpha(c, 0.32) };
}

/** Solid category swatch (timeline dot, lifecycle-stage dot). */
export function dotStyle(category: string): CSSProperties {
  return { backgroundColor: categoryColor(category) };
}

/** Colored eyebrow / accent text. */
export function textStyle(category: string): CSSProperties {
  return { color: categoryColor(category) };
}
