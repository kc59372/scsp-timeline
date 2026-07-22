/**
 * Edge middleware: (1) rate-limits HTML page routes, then (2) gates /admin.
 *
 * RATE LIMITING — throttles abusive clients (bulk HTML scraping) by client IP.
 * Disabled by default; enable with RATE_LIMIT_ENABLED="true" (see lib/ratelimit
 * .ts for tunables). Applies to page routes only — /api and static assets are
 * excluded by the matcher, so it never throttles the server's own render calls
 * to the (separately locked) JSON API. On multi-instance hosts this is
 * best-effort; a Google Cloud Armor policy is the exact global-limit upgrade.
 *
 * ADMIN — the in-app dashboard is HIDDEN by default now that review happens in
 * Airtable. When hidden, every /admin path (including /admin/login) is rewritten
 * to a non-existent route so Next renders the styled 404. Set ADMIN_ENABLED=
 * "true" to restore it: unauthenticated loads then redirect to /admin/login.
 */
import { NextResponse, type NextRequest } from "next/server";
import withAuth from "next-auth/middleware";
import { rateLimitConfig, checkRateLimit } from "@/lib/ratelimit";

const adminEnabled = process.env.ADMIN_ENABLED === "true";

// next-auth middleware: redirect unauthenticated /admin loads to the login page.
const authMiddleware = withAuth({ pages: { signIn: "/admin/login" } });

/** Best-effort client IP from proxy headers (Google Cloud LB sets these). */
function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export default function middleware(req: NextRequest, event: unknown) {
  const { pathname } = req.nextUrl;

  // 1) Rate limit (page routes only — matcher already excludes /api + static).
  if (rateLimitConfig().enabled) {
    const rl = checkRateLimit(clientIp(req));
    if (!rl.allowed) {
      return new NextResponse("Too Many Requests", {
        status: 429,
        headers: {
          "Retry-After": String(rl.resetSeconds),
          "X-RateLimit-Limit": String(rl.limit),
          "X-RateLimit-Remaining": String(rl.remaining),
          "Content-Type": "text/plain",
        },
      });
    }
  }

  // 2) Admin gate — only for /admin paths.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (!adminEnabled) {
      // Rewrite to a route that doesn't exist → styled 404, URL bar unchanged.
      return NextResponse.rewrite(new URL("/admin-not-found", req.url));
    }
    // The login page must stay reachable without auth.
    if (pathname === "/admin/login") return NextResponse.next();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (authMiddleware as any)(req, event);
  }

  return NextResponse.next();
}

export const config = {
  // Run on all page routes; exclude the JSON API and static assets. This keeps
  // rate limiting on HTML only and leaves internal server→API render calls
  // unthrottled.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
