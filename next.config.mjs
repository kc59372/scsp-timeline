/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV === "development";

// Content-Security-Policy.
// - script/style: Next inlines hydration scripts and Tailwind's runtime styles,
//   so 'unsafe-inline' is required; 'unsafe-eval' is dev-only (React Fast Refresh).
// - fonts: the app loads Google Fonts CSS (fonts.googleapis.com) whose files
//   come from fonts.gstatic.com (see app/layout.tsx).
// - connect: all client fetches hit our own /api (same-origin). The Airtable
//   POST is server-side (Node), so it isn't governed by this browser policy.
// - frame-ancestors 'none' + object-src 'none' + base-uri/form-action 'self'
//   close off clickjacking, plugin, and base-tag/form-hijack vectors.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: https:",
  "font-src 'self' https://fonts.gstatic.com data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // HSTS: only meaningful over HTTPS (prod). Two years + preload.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
