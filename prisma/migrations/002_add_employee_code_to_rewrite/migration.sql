-- AlterTable attendance_rewrite_requests: add nullable employee_code for per-employee rewrite requests
-- DDL already applied manually. This file records the schema change.
ALTER TABLE "attendance_rewrite_requests"
  ADD COLUMN IF NOT EXISTS "employee_code" VARCHAR(50) NULL;
