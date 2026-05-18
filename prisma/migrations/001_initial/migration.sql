-- CreateTable supervisors
CREATE TABLE IF NOT EXISTS "supervisors" (
    "id"              SERIAL PRIMARY KEY,
    "supervisor_name" VARCHAR(200) NOT NULL,
    "facility"        VARCHAR(50)  NOT NULL,
    "department"      VARCHAR(100) NOT NULL,
    "departments"     TEXT[]       NOT NULL DEFAULT '{}',
    "pin"             VARCHAR(10)  NOT NULL,
    "role"            VARCHAR(20)  NOT NULL DEFAULT 'supervisor',
    "is_active"       BOOLEAN      NOT NULL DEFAULT true,
    "created_at"      TIMESTAMP(6) NOT NULL DEFAULT NOW()
);

-- CreateTable employees
CREATE TABLE IF NOT EXISTS "employees" (
    "id"               SERIAL PRIMARY KEY,
    "employee_code"    VARCHAR(50)  NOT NULL UNIQUE,
    "employee_name"    VARCHAR(200) NOT NULL,
    "facility"         VARCHAR(50)  NOT NULL,
    "department"       VARCHAR(100) NOT NULL,
    "shift"            VARCHAR(10),
    "designation"      VARCHAR(100),
    "reporting_manager" VARCHAR(200),
    "roll_type"        VARCHAR(20),
    "gender"           VARCHAR(10),
    "is_active"        BOOLEAN      NOT NULL DEFAULT true,
    "loaded_at"        TIMESTAMP(6) NOT NULL DEFAULT NOW()
);

-- CreateTable attendance_header
CREATE TABLE IF NOT EXISTS "attendance_header" (
    "id"               SERIAL PRIMARY KEY,
    "attendance_date"  DATE         NOT NULL,
    "facility"         VARCHAR(50)  NOT NULL,
    "department"       VARCHAR(100) NOT NULL,
    "marked_by"        VARCHAR(200) NOT NULL,
    "marked_at"        TIMESTAMP(6) NOT NULL,
    "created_at"       TIMESTAMP(6) NOT NULL DEFAULT NOW(),
    "status"           VARCHAR(20)  NOT NULL DEFAULT 'submitted',
    "shift"            VARCHAR(10)
);

-- CreateTable attendance_detail
CREATE TABLE IF NOT EXISTS "attendance_detail" (
    "id"                   SERIAL PRIMARY KEY,
    "attendance_header_id" INTEGER      NOT NULL,
    "employee_id"          INTEGER,
    "employee_code"        VARCHAR(50)  NOT NULL,
    "employee_name"        VARCHAR(200) NOT NULL,
    "attendance_status"    VARCHAR(50)  NOT NULL,
    "remarks"              VARCHAR(500),
    "created_at"           TIMESTAMP(6) NOT NULL DEFAULT NOW(),
    "attendance_date"      DATE,
    CONSTRAINT "attendance_detail_attendance_header_id_fkey"
        FOREIGN KEY ("attendance_header_id")
        REFERENCES "attendance_header" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable attendance_rewrite_requests
CREATE TABLE IF NOT EXISTS "attendance_rewrite_requests" (
    "id"               SERIAL PRIMARY KEY,
    "attendance_date"  DATE         NOT NULL,
    "facility"         VARCHAR(50)  NOT NULL,
    "department"       VARCHAR(100) NOT NULL,
    "supervisor_name"  VARCHAR(200) NOT NULL,
    "reason"           TEXT         NOT NULL,
    "request_status"   VARCHAR(20)  NOT NULL DEFAULT 'pending',
    "requested_at"     TIMESTAMP(6) NOT NULL,
    "actioned_by"      VARCHAR(200),
    "actioned_at"      TIMESTAMP(6)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS "idx_attendance_header_date_facility_dept"
    ON "attendance_header" ("attendance_date", "facility", "department");

CREATE INDEX IF NOT EXISTS "idx_attendance_detail_header_id"
    ON "attendance_detail" ("attendance_header_id");

CREATE INDEX IF NOT EXISTS "idx_attendance_detail_employee_code"
    ON "attendance_detail" ("employee_code");

CREATE INDEX IF NOT EXISTS "idx_rewrite_facility_status"
    ON "attendance_rewrite_requests" ("facility", "request_status");
