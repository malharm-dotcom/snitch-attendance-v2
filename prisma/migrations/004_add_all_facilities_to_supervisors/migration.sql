-- AlterTable supervisors: add all_facilities, a PER-USER capability (orthogonal to role)
-- allowing a user to switch which facility their session is scoped to.
-- DDL applied manually. This file records the schema change.
ALTER TABLE "supervisors"
  ADD COLUMN IF NOT EXISTS "all_facilities" BOOLEAN NOT NULL DEFAULT false;
