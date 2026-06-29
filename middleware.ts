/**
 * Protect /admin/* page routes — unauthenticated loads redirect to the custom
 * login page (/admin/login). The login page itself is excluded (see matcher).
 * Admin *API* routes enforce auth in-handler (401 JSON) rather than here, so
 * clients get a proper status code instead of an HTML redirect.
 */
import withAuth from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/admin/login" },
});

export const config = {
  // All /admin paths except /admin/login.
  matcher: ["/admin/((?!login).*)", "/admin"],
};
