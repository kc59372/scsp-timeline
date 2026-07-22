# Static HTML export (backup / future migration)

The deployed site is the **dynamic Next.js/TS app** on Vercel + Neon (live data,
admin, ingest). This doc covers the **opt-in flat-HTML export** kept alongside it
as a zero-infrastructure backup — a folder of plain `.html` files that can be
hosted anywhere (or opened locally) with no server or database.

The export is **additive and gated**: nothing here changes the Vercel build. The
switch is the `STATIC_EXPORT=1` env var.

## Build it

```bash
npm run snapshot        # optional: refresh data/snapshot.json from the live site
npm run build:static    # → ./out (flat HTML). Uses the committed snapshot.
```

Output: `out/index.html`, `out/timeline.html`, `out/compare.html`, plus one file
per entry under `out/program/<id>.html` and `out/system/<id>.html`, and hashed
JS/CSS under `out/_next/`. Deploy `out/` to any static host (Netlify, GitHub
Pages, S3/CloudFront, Vercel static) or open `index.html` directly.

## How it works

| Concern | Dynamic app (default) | Static export (`STATIC_EXPORT=1`) |
|---|---|---|
| Data source | HTTP → `/api` → Prisma/Neon (live) | `data/snapshot.json`, baked at build |
| `/system/[id]`, `/program/[id]` | on-demand dynamic | one pre-rendered file per id |
| Admin, `/api/*`, middleware | active | set aside (export forbids them) |
| Security headers | `next.config` `headers()` | apply at the static host instead |

Key files:

- [lib/pageData.ts](../lib/pageData.ts) — the switch. Public pages import only
  from here; it reads live (`lib/milestones.ts`) by default, or the snapshot
  (`lib/snapshot.ts`, lazy-imported) when `STATIC_EXPORT=1`.
- [lib/snapshot.ts](../lib/snapshot.ts) — build-time reader of the JSON snapshot.
- [scripts/snapshot.mjs](../scripts/snapshot.mjs) — refreshes `data/snapshot.json`
  from the live API (`SNAPSHOT_SOURCE` overrides the URL).
- [scripts/build-static.sh](../scripts/build-static.sh) — sets aside `app/api`,
  `app/admin`, and `middleware.ts` (restored on exit), then runs the export.
- [next.config.mjs](../next.config.mjs) — `output: "export"` only when
  `STATIC_EXPORT=1`.

## Content freshness

The static site is a point-in-time snapshot; it updates only when you re-run
`npm run snapshot && npm run build:static` and redeploy `out/`. The interactive
timeline/compare filtering still works in the exported site (it runs client-side
on data embedded in the HTML), and the `?q=` deep link is hydrated client-side.

## When migrating fully to static

If the project ever drops the dynamic backend for good: keep this path, remove
`app/admin`, `app/api`, and `middleware.ts` from the repo, and replace the
"refresh from live API" snapshot step with whatever becomes the data source
(e.g. a committed JSON edited by hand, or an export from another tool).
