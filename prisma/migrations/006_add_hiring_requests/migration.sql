-- CreateTable hiring_requests: hiring tracker with two-step approval on existing roles.
--
--   Pending Manager -> (manager approves) -> Pending HR/Admin -> (admin approves) -> Approved
--   Approved -> In Progress -> Joined -> Closed   (admin-driven)
--   any approver may Reject with a mandatory comment -> Rejected
--
-- No new roles: 'manager' and 'admin' are the session roles already in use.
-- DDL applied manually. This file records the schema change.
CREATE TABLE IF NOT EXISTS "hiring_requests" (
    "id"                    SERIAL PRIMARY KEY,
    "department"            VARCHAR(100) NOT NULL,
    -- Free text: not every sub-department exists in the canonical department list.
    "sub_department"        VARCHAR(100) NULL,
    "position"              VARCHAR(200) NOT NULL,
    "headcount"             INTEGER      NOT NULL,
    -- Stamped server-side from the session; never accepted from the client.
    "facility"              VARCHAR(50)  NOT NULL,
    "req_type"              VARCHAR(20)  NOT NULL,
    "justification"         TEXT         NOT NULL,
    "requested_by"          VARCHAR(200) NOT NULL,
    -- Calendar date: plain YYYY-MM-DD, never timezone-shifted.
    "expected_joining_date" DATE         NOT NULL,
    "status"                VARCHAR(20)  NOT NULL DEFAULT 'Pending Manager',
    "mgr_approved_by"       VARCHAR(200) NULL,
    -- Instants, not calendar dates: timestamptz, stored UTC.
    "mgr_approved_at"       TIMESTAMPTZ(6) NULL,
    "admin_approved_by"     VARCHAR(200) NULL,
    "admin_approved_at"     TIMESTAMPTZ(6) NULL,
    "rejection_reason"      TEXT         NULL,
    "joined_count"          INTEGER      NOT NULL DEFAULT 0,
    "joined_notes"          TEXT         NULL,
    "created_at"            TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "closed_at"             TIMESTAMPTZ(6) NULL,

    CONSTRAINT "hiring_requests_status_check" CHECK ("status" IN (
        'Pending Manager', 'Pending HR/Admin', 'Approved',
        'Rejected', 'In Progress', 'Joined', 'Closed'
    )),
    CONSTRAINT "hiring_requests_req_type_check"
        CHECK ("req_type" IN ('New', 'Replacement')),
    CONSTRAINT "hiring_requests_headcount_check"
        CHECK ("headcount" > 0),
    -- Keeps the Open Positions figure (SUM headcount - joined_count) from ever going
    -- negative, and stops a typo recording more joiners than the role asked for.
    CONSTRAINT "hiring_requests_joined_count_check"
        CHECK ("joined_count" >= 0 AND "joined_count" <= "headcount"),
    -- A rejection must carry a reason; nothing else may.
    CONSTRAINT "hiring_requests_rejection_reason_check"
        CHECK (("status" = 'Rejected') = ("rejection_reason" IS NOT NULL))
);

-- Approver queues: pending rows within the session's allowed facilities.
CREATE INDEX IF NOT EXISTS "hiring_requests_facility_status_idx"
    ON "hiring_requests" ("facility", "status");

-- Department-wise requirement table on the summary tab.
CREATE INDEX IF NOT EXISTS "hiring_requests_department_idx"
    ON "hiring_requests" ("department");
