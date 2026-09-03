-- CreateTable ot_requests: the overtime ledger, single-level Manager approval.
--
-- OT is a SEPARATE ledger. It is never written into attendance_detail.attendance_status —
-- a day can be Present AND carry OT hours, and merging the two would corrupt every
-- attendance count and the LOP calculation.
--
-- DDL applied manually. This file records the schema change.
CREATE TABLE IF NOT EXISTS "ot_requests" (
    "id"               SERIAL PRIMARY KEY,
    "employee_code"    VARCHAR(50)  NOT NULL,
    -- Stamped server-side from the session; never accepted from the client.
    "facility"         VARCHAR(50)  NOT NULL,
    -- Calendar date: plain YYYY-MM-DD, never timezone-shifted.
    "ot_date"          DATE         NOT NULL,
    "ot_hours"         NUMERIC(4,2) NOT NULL,
    "reason"           TEXT         NOT NULL,
    "status"           VARCHAR(20)  NOT NULL DEFAULT 'Pending',
    "requested_by"     VARCHAR(200) NOT NULL,
    "approved_by"      VARCHAR(200) NULL,
    -- An instant, not a calendar date: timestamptz, stored UTC.
    "approved_at"      TIMESTAMPTZ(6) NULL,
    "rejection_reason" TEXT         NULL,
    "created_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "ot_requests_employee_code_fkey"
        FOREIGN KEY ("employee_code") REFERENCES "employees" ("employee_code"),
    -- Half-hour steps only, and a day cannot hold more than 24 OT hours.
    CONSTRAINT "ot_requests_hours_step_check"
        CHECK ("ot_hours" > 0 AND "ot_hours" <= 24 AND mod("ot_hours", 0.5) = 0),
    CONSTRAINT "ot_requests_status_check"
        CHECK ("status" IN ('Pending', 'Approved', 'Rejected'))
);

-- Approver queue: pending requests within the session's allowed facilities.
CREATE INDEX IF NOT EXISTS "ot_requests_facility_status_idx"
    ON "ot_requests" ("facility", "status");

-- Employee View / OT report: approved hours for an employee across a date range.
CREATE INDEX IF NOT EXISTS "ot_requests_employee_code_ot_date_idx"
    ON "ot_requests" ("employee_code", "ot_date");
