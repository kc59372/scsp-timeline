#!/bin/sh
set -e

# Apply pending DB migrations before starting the server.
# NOTE: does NOT seed — prisma/seed.ts is destructive (deleteMany). Seed once
# manually on first deploy (see DEPLOY.md).
echo "[entrypoint] applying migrations..."
npx prisma migrate deploy

echo "[entrypoint] starting Next.js..."
exec npm run start
