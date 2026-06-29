/**
 * NextAuth config — single env admin (Credentials provider, JWT sessions).
 *
 * Admin identity is a single shared credential from the environment:
 *   ADMIN_EMAIL          — the admin login email
 *   ADMIN_PASSWORD_HASH  — bcrypt hash of the password (see scripts/hash_password.ts)
 *   NEXTAUTH_SECRET      — JWT signing secret
 *
 * Multi-user is a future upgrade (swap the env check for a User table).
 */
import type { NextAuthOptions, Session } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/admin/login" },
  providers: [
    CredentialsProvider({
      name: "Admin",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminHash = process.env.ADMIN_PASSWORD_HASH;
        if (!adminEmail || !adminHash) return null; // not configured
        if (!credentials?.email || !credentials.password) return null;

        const emailOk =
          credentials.email.trim().toLowerCase() === adminEmail.trim().toLowerCase();
        const passOk = await bcrypt.compare(credentials.password, adminHash);
        if (!emailOk || !passOk) return null;

        return { id: "admin", email: adminEmail, name: "Administrator" };
      },
    }),
  ],
};

/** Returns the admin session, or null if unauthenticated. For API gating. */
export async function requireAdmin(): Promise<Session | null> {
  return getServerSession(authOptions);
}
