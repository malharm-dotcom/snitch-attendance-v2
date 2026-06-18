-- AlterTable employees: add joining_date and exit_date for payroll date tracking
-- DDL applied manually. This file records the schema change.
ALTER TABLE "employees"
  ADD COLUMN IF NOT EXISTS "joining_date" DATE NULL,
  ADD COLUMN IF NOT EXISTS "exit_date"    DATE NULL;
