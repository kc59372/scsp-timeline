/**
 * Generate a bcrypt hash for the admin password.
 *
 *   npx ts-node scripts/hash_password.ts '<password>'
 *
 * Copy the printed hash into ADMIN_PASSWORD_HASH in your .env. To rotate the
 * team's shared admin credential, re-run with a new password.
 *
 * IMPORTANT: for docker-compose.prod.yml (env_file), use the $$-escaped form
 * printed below — Docker Compose interpolates "$" in env_file values, so an
 * unescaped bcrypt hash gets mangled and login silently fails.
 */
import bcrypt from "bcryptjs";

const password = process.argv[2];
if (!password) {
  console.error("Usage: ts-node scripts/hash_password.ts '<password>'");
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
// stdout: the raw hash (safe for a plain env / most hosts).
console.log(hash);
// stderr: the Compose-safe form so piping still captures the raw hash cleanly.
console.error("\n# docker-compose env_file (.env.production) — escape $ as $$:");
console.error(hash.replace(/\$/g, "$$$$"));
