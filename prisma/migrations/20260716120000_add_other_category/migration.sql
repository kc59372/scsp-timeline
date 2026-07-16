-- AlterEnum
-- Add the OTHER catch-all before reassigning PROCUREMENT_CONTRACT rows off it.
-- Adding a value is safe in a transaction; the value is only USED afterward (in
-- the backfill + the following remove migration).
ALTER TYPE "Category" ADD VALUE 'OTHER';
