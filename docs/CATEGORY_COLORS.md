# Category Color Palette

The timeline color-codes every `Category` with a single accent hex. Colors drive
the filter bubbles (dot + solid fill when selected), the card left sidebar, the
eyebrow label, the tinted pill, and the program lifecycle dots.

**Source of truth:** [`lib/categories.ts`](../lib/categories.ts) (`CATEGORY_STYLES`).
This document mirrors it — if you change a color, update it in both places.

## Mapping

| Category (enum) | Label | Hex | Swatch |
|---|---|---|---|
| `COMMAND_CONTROL` | Command & Control | `#1658AF` | 🟦 blue |
| `CYBER` | Cyber & EW | `#662973` | 🟪 deep purple |
| `ISR` | ISR | `#0F7173` | 🟩 teal |
| `LOGISTICS_SUSTAINMENT` | Logistics & Sustainment | `#DA7447` | 🟧 orange |
| `MEDICAL` | Medical | `#2F7D5F` | 🟩 clinical green |
| `POLICY_DIRECTIVE` | Policy / Directive | `#877A6B` | 🟫 warm taupe |
| `RESEARCH_DEVELOPMENT` | Research & Development | `#B5527D` | 🟪 magenta-rose |
| `SPACE` | Space | `#8397D2` | 🟦 periwinkle |
| `TARGETING` | Targeting | `#A6392E` | 🟥 brick red |
| `TRAINING_SIMULATION` | Training & Simulation | `#B07D2B` | 🟨 amber gold |
| `UNMANNED_SYSTEMS` | Unmanned Systems | `#4A6C8C` | 🟦 steel blue |
| `OTHER` | Other | `#436829` | 🟩 olive green |

`OTHER` is the catch-all bucket for items that match no mission-domain keyword
(general AI/ML R&D, cross-domain contract vehicles); it inherits the olive/forest
green the retired `PROCUREMENT_CONTRACT` category used to carry, and sorts last
(after Unmanned Systems) in filter pills and legends — see `CATEGORY_ORDER` in
`lib/categories.ts`. Fallback for any *unknown* category string: `#7B7B7B`
(grey), labeled "Other".

## Palette notes

- Eight of these are the curated brand hexes; four (`MEDICAL`, `TARGETING`,
  `TRAINING_SIMULATION`, `UNMANNED_SYSTEMS`) were added in the same muted register
  to cover all 12 categories.
- `RESEARCH_DEVELOPMENT` was moved off its original violet (`#844690`) to
  `#B5527D` so it no longer reads as the same purple as `CYBER` (`#662973`).
- Foreground text on a solid fill (selected filter pill) is chosen automatically
  by luminance — see `categoryFg()` in `lib/categories.ts`.
