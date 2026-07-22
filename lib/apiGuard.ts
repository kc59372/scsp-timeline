/**
 * Read-access gate for the public data API.
 *
 * The public website renders entirely server-side: its async server components
 * fetch /api/milestones + /api/programs from within the deployment (see
 * lib/milestones.ts) and the browser only ever receives rendered HTML. So these
 * JSON endpoints have NO legitimate direct-from-browser caller — the only reason
 * to hit them raw is to bulk-export the dataset. We lock them to:
 *   - internal server-render calls carrying the INTERNAL_API_TOKEN header, or
 *   - an authenticated admin session.
 * Everyone else (curl / scripts pulling `?pageSize=all`) gets 401.
 *
 * NOTE: this protects the JSON API, not the data itself — approved entries are
 * still rendered into the public site's HTML by design. It removes the trivial
 * "download the whole DB as JSON in one call" vector; it does not make public
 * data private.
 *
 * If INTERNAL_API_TOKEN is unset the gate is OPEN — a dev convenience mirroring
 * the INGEST_TOKEN pattern. Set it in production to activate the lock.
 */
import { timingSafeEqual } from "crypto";
import { requireAdmin } from "./auth";

/** Constant-time check of the x-internal-token header against INTERNAL_API_TOKEN. */
export function internalTokenOk(req: Request): boolean {
  const expected = process.env.INTERNAL_API_TOKEN;
  if (!expected) return false;
  const provided = req.headers.get("x-internal-token") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * True if the caller may read the data API: the internal server render (token),
 * or a logged-in admin. Open when INTERNAL_API_TOKEN is unset (dev). The token
 * check runs first so the common public-render path never pays for a session
 * lookup.
 */
export async function canReadApi(req: Request): Promise<boolean> {
  if (!process.env.INTERNAL_API_TOKEN) return true; // unset → open (dev only)
  if (internalTokenOk(req)) return true;
  return !!(await requireAdmin());
}
