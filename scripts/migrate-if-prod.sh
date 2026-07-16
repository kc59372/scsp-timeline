#!/usr/bin/env sh
# Run Prisma migrations ONLY on Vercel production builds.
#
# Why: the build command runs on every deployment, including branch/PR
# *preview* builds. Preview builds (a) have no DB credentials — the Neon
# DATABASE_URL/DIRECT_URL are Production-scoped — so `prisma migrate deploy`
# fails at get-config, and (b) MUST NOT apply a branch's migrations to the
# shared production database before the PR is merged. Gating on VERCEL_ENV
# lets previews build (generate + next build need no DB) while production still
# migrates. VERCEL_ENV is set by Vercel to production | preview | development;
# it is unset for local `npm run build` (treated as non-production).
if [ "$VERCEL_ENV" = "production" ]; then
  echo "VERCEL_ENV=production → running prisma migrate deploy"
  npx prisma migrate deploy
else
  echo "VERCEL_ENV=${VERCEL_ENV:-unset} → skipping prisma migrate deploy (non-production build)"
fi
