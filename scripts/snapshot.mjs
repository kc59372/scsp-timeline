/**
 * Refresh data/snapshot.json from the live site's public API.
 *
 * The static HTML export bakes this snapshot into the pages at build time, so
 * re-run this whenever you want the flat site to reflect newly-approved data:
 *
 *   node scripts/snapshot.mjs                       # pull from the default prod URL
 *   SNAPSHOT_SOURCE=http://localhost:3000 node scripts/snapshot.mjs
 */
import fs from "node:fs";
import path from "node:path";

const base = process.env.SNAPSHOT_SOURCE ?? "https://scsp-timeline.vercel.app";
const url = `${base.replace(/\/$/, "")}/api/milestones?pageSize=all`;

console.log(`Fetching ${url} ...`);
const res = await fetch(url);
if (!res.ok) {
  console.error(`Failed: HTTP ${res.status}`);
  process.exit(1);
}
const data = await res.json();
if (!Array.isArray(data.items)) {
  console.error("Unexpected response shape (no items array)");
  process.exit(1);
}

const out = path.join(process.cwd(), "data", "snapshot.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(data, null, 0));
console.log(`Wrote ${data.items.length} milestones → data/snapshot.json`);
