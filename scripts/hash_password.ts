/**
 * Generate a bcrypt hash for the admin password.
 *
 *   npx ts-node scripts/hash_password.ts '<password>'
 *
 * Copy the printed hash into ADMIN_PASSWORD_HASH in your .env. To rotate the
 * team's shared admin credential, re-run with a new password.
 */
import bcrypt from "bcryptjs";

const password = process.argv[2];
if (!password) {
  console.error("Usage: ts-node scripts/hash_password.ts '<password>'");
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
console.log(hash);
