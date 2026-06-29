/**
 * Seed runner.
 *
 * The canonical seed logic lives in `prisma/seed.ts` (wired to
 * `prisma db seed` via package.json). This thin runner lets you invoke the
 * same seed directly, e.g. for CI or ad-hoc runs:
 *
 *   npx ts-node scripts/seed_db.ts
 *
 * Importing the module executes its `main()` (it self-runs and disconnects).
 */
import "../prisma/seed";
