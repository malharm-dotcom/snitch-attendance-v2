# Snitch Attendance — Coolify Deployment Guide

## Prerequisites

- Coolify instance running on your server
- GitHub repository with this code (or local access)
- Domain name pointed at your server

---

## Step 1: Create PostgreSQL Service in Coolify

1. Open Coolify → **Resources** → **New Resource** → **Database** → **PostgreSQL 16**
2. Set:
   - Database name: `snitch_attendance`
   - Username: `snitch`
   - Password: (generate a strong random password — save it)
3. Click **Save**. Copy the **Connection String** — it looks like:
   ```
   postgresql://snitch:<password>@<host>:<port>/snitch_attendance
   ```

---

## Step 2: Create the Application in Coolify

1. **Resources** → **New Resource** → **Application** → **Dockerfile**
2. Connect your GitHub repository (or upload code)
3. Set **Build Pack** to `Dockerfile`
4. Port: `3000`

---

## Step 3: Set Environment Variables

In Coolify → your app → **Environment Variables**, add:

```
DATABASE_URL=postgresql://snitch:<password>@<coolify-db-host>:<port>/snitch_attendance
SESSION_SECRET=<generate 32+ random characters, e.g.: openssl rand -base64 32>
NEXT_PUBLIC_APP_URL=https://attendance.yourdomain.com
```

> **Important**: `SESSION_SECRET` must be at least 32 characters and kept secret.

---

## Step 4: First Deploy — Run Migrations

After the first successful build, open a **Terminal** in Coolify for your app and run:

```bash
node -e "const { execSync } = require('child_process'); execSync('npx prisma migrate deploy', { stdio: 'inherit' });"
```

Or using Coolify's Run Command feature:
```
npx prisma migrate deploy
```

This creates all tables from `prisma/migrations/001_initial/migration.sql`.

---

## Step 5: Export Data from Google Sheets

Export these two sheets as CSV with exact column headers:

### supervisors.csv
```
supervisor_name,facility,department,departments,pin,role,is_active
Malhar,WH2,B2C,"B2C Return, B2C Forward",1902,manager,TRUE
```

- `departments` = comma-separated list if supervisor covers multiple depts (in quotes)
- `role` = `supervisor` | `manager` | `admin`
- `is_active` = `TRUE` or `FALSE`

### employee_master.csv
```
employee_code,employee_name,facility,department,is_active,shift,designation,reporting_manager,roll_type,gender
GS20301017,BRIJESH MAURYA,NORTH,Admin,TRUE,Day,,,On Roll,Male
```

- `facility` = `WH1` | `WH2` | `NORTH`
- `shift` = `Day` | `Night` | (blank = appears for both shifts)
- `is_active` = `TRUE` or `FALSE`

Place both files in the `data/` directory.

---

## Step 6: Seed Supervisors and Employees

In Coolify terminal for your app:

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
```

---

## Step 7: Export Attendance History from Snowflake

Export these tables as CSV:

### attendance_header.csv
Columns: `ID,ATTENDANCE_DATE,FACILITY,DEPARTMENT,MARKED_BY,MARKED_AT,CREATED_AT,STATUS,SHIFT`

### attendance_detail.csv
Columns: `ID,ATTENDANCE_HEADER_ID,EMPLOYEE_ID,EMPLOYEE_CODE,EMPLOYEE_NAME,ATTENDANCE_STATUS,REMARKS,CREATED_AT,ATTENDANCE_DATE`

> **Note**: If your Snowflake export joins header data onto each detail row, the script ignores columns after index 9.

### rewrite_requests.csv
Columns: `REQUEST_ID,ATTENDANCE_DATE,FACILITY,DEPARTMENT,SUPERVISOR_NAME,REASON,REQUEST_STATUS,REQUESTED_AT,ACTIONED_BY,ACTIONED_AT,CREATED_AT`

Place all three in the `data/` directory, then run:

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/migrate-snowflake.ts
```

---

## Step 8: DNS / Domain Setup

In Coolify → your app → **Domains**:
1. Add your domain: `attendance.yourdomain.com`
2. Enable **HTTPS** (Coolify handles Let's Encrypt automatically)
3. In your DNS provider, add an **A record**:
   ```
   attendance  →  <your-server-ip>
   ```

---

## Step 9: Subsequent Deploys

Push to your main branch → Coolify auto-deploys. Migrations run automatically via:
```
npx prisma migrate deploy
```
(add this as a **Pre-Deploy Command** in Coolify app settings)

---

## Step 10: Maplemonk / BI Tool Connection

To connect Maplemonk (or any BI tool) directly to PostgreSQL instead of Snowflake:

**Connection string format:**
```
postgresql://snitch:<password>@<coolify-db-host>:<port>/snitch_attendance?sslmode=require
```

**Key tables:**
- `attendance_header` — one row per submission (date + facility + dept + shift)
- `attendance_detail` — one row per employee per submission
- `employees` — employee master
- `supervisors` — user accounts
- `attendance_rewrite_requests` — edit request log

**Recommended view for Maplemonk (deduplicated attendance):**
```sql
CREATE OR REPLACE VIEW v_attendance_latest AS
SELECT
  d.employee_code,
  d.employee_name,
  d.attendance_status,
  d.remarks,
  d.attendance_date,
  h.facility,
  h.department,
  h.shift,
  h.marked_by,
  h.marked_at
FROM (
  SELECT
    d2.*,
    ROW_NUMBER() OVER (
      PARTITION BY d2.employee_code, d2.attendance_date, h2.facility, h2.department, COALESCE(h2.shift,'Day')
      ORDER BY h2.id DESC, d2.id DESC
    ) AS rn,
    h2.id AS hid
  FROM attendance_detail d2
  JOIN attendance_header h2 ON d2.attendance_header_id = h2.id
) sub
JOIN attendance_detail d ON d.id = sub.id
JOIN attendance_header h ON h.id = sub.hid
WHERE sub.rn = 1;
```

---

## Environment Variables Reference

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://snitch:pass@host:5432/snitch_attendance` |
| `SESSION_SECRET` | Cookie signing secret (32+ chars) | `randomly-generated-long-secret-key` |
| `NEXT_PUBLIC_APP_URL` | Public URL of the app | `https://attendance.yourdomain.com` |

---

## Troubleshooting

**"Session expired" on every page load** → `SESSION_SECRET` is not set or changed between deploys. It must be a stable value stored in Coolify env vars.

**"Failed to fetch employees"** → Check `DATABASE_URL` is correct and PostgreSQL service is running.

**"Invalid name or PIN"** → Run the seed script — supervisors table may be empty.

**Prisma migration fails** → Database may already have tables from a previous run. Safe to run `prisma migrate deploy` multiple times — it's idempotent.
