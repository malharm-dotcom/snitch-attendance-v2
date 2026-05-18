# Snitch Attendance — Full Migration: Next.js + PostgreSQL

## Claude Code Prompt (paste this entire file)

\---

## PROJECT OVERVIEW

You are building a production-grade attendance management system for Snitch warehouse operations called **Snitch Attendance**. This is a **migration** from an existing system (vanilla HTML + n8n workflows + Google Sheets + Snowflake) to Next.js + PostgreSQL hosted on Coolify.

The existing frontend (`index.html`) is provided below in full. You must preserve ALL existing functionality exactly, and improve the UI/UX to feel polished, seamless, and production-quality — mobile and desktop responsive equally.

The existing system has these users:

* **Supervisors** (\~29 people): Mark daily attendance for their department's employees. Access via PIN login. Mobile-heavy usage.
* **Managers** (2–3 people): Approve rewrite requests, view attendance logs across all departments. Desktop + mobile.

\---

## TECH STACK

* **Framework**: Next.js 14 (App Router)
* **Database**: PostgreSQL (via Coolify managed Postgres or external)
* **ORM**: Prisma
* **Auth**: Custom PIN-based (no OAuth, no email — exactly as existing)
* **Styling**: Tailwind CSS + keep existing CSS variables/design tokens (dark/accent green `#c8df20` brand)
* **Fonts**: Syne + DM Mono (same as existing — import from Google Fonts)
* **Hosting**: Coolify (Docker-based, self-hosted)
* **Deployment**: Dockerfile + docker-compose.yml included

\---

## FOLDER STRUCTURE TO CREATE

```
snitch-attendance/
├── app/
│   ├── layout.tsx                    # Root layout, fonts, global CSS
│   ├── page.tsx                      # Login screen (supervisor + manager toggle)
│   ├── globals.css                   # All CSS variables from existing index.html
│   ├── supervisor/
│   │   └── page.tsx                  # Supervisor app (mark attendance + history tabs)
│   ├── manager/
│   │   └── page.tsx                  # Manager portal (requests + attendance log tabs)
│   └── api/
│       ├── auth/
│       │   └── route.ts              # POST /api/auth — PIN login for both roles
│       ├── supervisors/
│       │   └── route.ts              # GET /api/supervisors — list for login dropdown
│       ├── employees/
│       │   └── route.ts              # GET /api/employees?facility=\&department=\&shift=
│       ├── attendance/
│       │   ├── submit/
│       │   │   └── route.ts          # POST /api/attendance/submit
│       │   ├── check/
│       │   │   └── route.ts          # GET /api/attendance/check?facility=\&department=\&date=\&shift=
│       │   ├── history/
│       │   │   └── route.ts          # GET /api/attendance/history?facility=\&department=\&date=\&supervisor=
│       │   └── history-range/
│       │       └── route.ts          # GET /api/attendance/history-range?facility=\&department=\&from\_date=\&to\_date=\&supervisor=
│       ├── rewrite/
│       │   ├── request/
│       │   │   └── route.ts          # POST /api/rewrite/request
│       │   ├── list/
│       │   │   └── route.ts          # GET /api/rewrite/list
│       │   └── action/
│       │       └── route.ts          # POST /api/rewrite/action (approve/reject)
│       └── today-status/
│           └── route.ts              # GET /api/today-status?attendance\_date=
├── components/
│   ├── login/
│   │   ├── LoginScreen.tsx
│   │   ├── NameDropdown.tsx
│   │   └── PinInput.tsx
│   ├── supervisor/
│   │   ├── SessionBanner.tsx
│   │   ├── ShiftToggle.tsx
│   │   ├── MarkAttendance.tsx
│   │   ├── EmployeeRow.tsx
│   │   ├── SubmissionBanner.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── SummaryBar.tsx
│   │   └── HistoryPanel.tsx
│   ├── history/
│   │   ├── HistoryTable.tsx          # Single-day table view
│   │   └── HistoryMatrix.tsx         # Multi-day matrix view
│   ├── manager/
│   │   ├── RequestCard.tsx
│   │   ├── BulkToolbar.tsx
│   │   ├── TodayStatusGrid.tsx
│   │   ├── DeptCard.tsx
│   │   └── ManagerMatrix.tsx
│   └── shared/
│       ├── Toast.tsx
│       ├── Modal.tsx
│       └── Topbar.tsx
├── lib/
│   ├── db.ts                         # Prisma client singleton
│   ├── auth.ts                       # Session helpers (cookie-based, httpOnly)
│   ├── ist.ts                        # IST timestamp helpers (never use server UTC)
│   └── constants.ts                  # DEPARTMENTS, STATUSES, FACILITIES arrays
├── prisma/
│   ├── schema.prisma                 # Full schema (see below)
│   └── migrations/
│       └── 001\_initial/
│           └── migration.sql         # Initial migration SQL
├── public/
│   └── logo.png                      # Snitch logo (extract from existing base64)
├── middleware.ts                     # Route protection — redirect unauthenticated users
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── package.json
```

\---

## PRISMA SCHEMA

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE\_URL")
}

model Supervisor {
  id              Int      @id @default(autoincrement())
  supervisorName  String   @map("supervisor\_name") @db.VarChar(200)
  facility        String   @db.VarChar(50)
  department      String   @db.VarChar(100)
  departments     String\[] // array of departments for multi-dept supervisors
  pin             String   @db.VarChar(10)
  role            String   @default("supervisor") @db.VarChar(20) // supervisor | manager
  isActive        Boolean  @default(true) @map("is\_active")
  createdAt       DateTime @default(now()) @map("created\_at")

  @@map("supervisors")
}

model Employee {
  id               Int      @id @default(autoincrement())
  employeeCode     String   @unique @map("employee\_code") @db.VarChar(50)
  employeeName     String   @map("employee\_name") @db.VarChar(200)
  facility         String   @db.VarChar(50)
  department       String   @db.VarChar(100)
  shift            String?  @db.VarChar(10) // Day | Night | null (shows for both)
  designation      String?  @db.VarChar(100)
  reportingManager String?  @map("reporting\_manager") @db.VarChar(200)
  rollType         String?  @map("roll\_type") @db.VarChar(20) // On Roll | Off Roll
  gender           String?  @db.VarChar(10) // Male | Female
  isActive         Boolean  @default(true) @map("is\_active")
  loadedAt         DateTime @default(now()) @map("loaded\_at")

  attendanceDetails AttendanceDetail\[]

  @@map("employees")
}

model AttendanceHeader {
  id             Int       @id @default(autoincrement())
  attendanceDate DateTime  @map("attendance\_date") @db.Date
  facility       String    @db.VarChar(50)
  department     String    @db.VarChar(100)
  markedBy       String    @map("marked\_by") @db.VarChar(200)
  markedAt       DateTime  @map("marked\_at") @db.Timestamp(6)
  createdAt      DateTime  @default(now()) @map("created\_at") @db.Timestamp(6)
  status         String    @default("submitted") @db.VarChar(20)
  shift          String?   @db.VarChar(10)

  details AttendanceDetail\[]

  @@map("attendance\_header")
}

model AttendanceDetail {
  id               Int      @id @default(autoincrement())
  headerId         Int      @map("attendance\_header\_id")
  employeeId       Int?     @map("employee\_id")
  employeeCode     String   @map("employee\_code") @db.VarChar(50)
  employeeName     String   @map("employee\_name") @db.VarChar(200)
  attendanceStatus String   @map("attendance\_status") @db.VarChar(50)
  remarks          String?  @db.VarChar(500)
  createdAt        DateTime @default(now()) @map("created\_at") @db.Timestamp(6)
  attendanceDate   DateTime? @map("attendance\_date") @db.Date

  header   AttendanceHeader @relation(fields: \[headerId], references: \[id])
  employee Employee?        @relation(fields: \[employeeCode], references: \[employeeCode])

  @@map("attendance\_detail")
}

model AttendanceRewriteRequest {
  id             Int       @id @default(autoincrement())
  attendanceDate DateTime  @map("attendance\_date") @db.Date
  facility       String    @db.VarChar(50)
  department     String    @db.VarChar(100)
  supervisorName String    @map("supervisor\_name") @db.VarChar(200)
  reason         String    @db.Text
  requestStatus  String    @default("pending") @map("request\_status") @db.VarChar(20)
  requestedAt    DateTime  @map("requested\_at") @db.Timestamp(6)
  actionedBy     String?   @map("actioned\_by") @db.VarChar(200)
  actionedAt     DateTime? @map("actioned\_at") @db.Timestamp(6)

  @@map("attendance\_rewrite\_requests")
}
```

\---

## CRITICAL BUSINESS LOGIC — READ EVERY WORD

### 1\. IST Timestamps

ALL timestamps must be IST. In the browser this is `new Date(Date.now() + 5.5 \* 3600000)`. On the server (API routes) use: `new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))`. NEVER use `new Date()` raw on the server — it will be UTC. Put this in `lib/ist.ts`.

### 2\. Facility Logic

* WH1 and WH2 are South facilities — supervisors logged in to either see employees from BOTH WH1 and WH2 for their department.
* SAPL-NORTH-TAURU (stored as NORTH) supervisors see ONLY their own facility.
* `isSouth = facility === 'WH1' || facility === 'WH2'`
* In `GET /api/employees`: if isSouth, query `WHERE facility IN ('WH1', 'WH2')`, else `WHERE facility = $facility`

### 3\. Shift Filtering

* Employee master has `shift` column: `Day`, `Night`, or `null`
* `null` means employee appears for BOTH shifts (no backfill needed)
* Filter: `WHERE (shift = $shift OR shift IS NULL)`
* History tab intentionally does NOT filter by shift

### 4\. Deduplication in fact queries

* Multiple headers can exist for same date+facility+dept+shift (resubmissions)
* Dedup at detail level: `ROW\_NUMBER() OVER (PARTITION BY employee\_code, attendance\_date, facility, department, COALESCE(shift,'Day') ORDER BY header\_id DESC, detail\_id DESC) = 1`
* `COALESCE(shift, 'Day')` — NULL treated as Day for dedup purposes

### 5\. Multi-department supervisors

* `supervisors.departments` is a text array in PG
* When loading employees, fetch for ALL departments in the array
* When submitting, group employees by their actual facility+department and create separate headers per group
* South supervisors submit cross-facility: one header per facility per department

### 6\. Rewrite flow

* `pending` → supervisor cannot resubmit, locked
* `approved` → supervisor can resubmit, date locked to approved date
* No status / not submitted → normal flow

### 7\. Submission check

* `GET /api/attendance/check` returns: `{ submitted, marked\_by, marked\_at, request\_status, shift }`
* Must check the latest header for the specific date+facility+dept+shift combination

### 8\. Auth

* PIN stored as plaintext in DB (matching existing system)
* On login: query supervisors table by name + pin + is\_active=true
* Return a signed httpOnly cookie session (use `iron-session` or `jose`)
* Session payload: `{ supervisorName, facility, department, departments\[], role }`
* Middleware protects `/supervisor` and `/manager` routes

### 9\. Today-status endpoint

* Returns all submitted headers for a given date
* Manager sees WH1+WH2 combined if they are a South manager, else their facility only
* Returns: `{ submissions: \[{ facility, department, marked\_by, marked\_at }] }`

\---

## API ROUTES — EXACT SPECIFICATIONS

### `GET /api/supervisors`

Returns list of supervisor names for the login dropdown.
Query param: `role=manager` returns only managers.
Response: `{ supervisors: string\[] }`

### `POST /api/auth`

Body: `{ supervisor\_name, pin }`
Validates PIN, sets httpOnly session cookie.
Response: `{ success, supervisor\_name, facility, department, departments, role }`

### `GET /api/employees`

Query: `facility`, `departments` (comma-separated), `department`, `shift`
Applies isSouth logic and shift filtering.
Response: `{ employees: \[{ id, employee\_code, employee\_name, facility, department, shift }] }`

### `POST /api/attendance/submit`

Body: `{ attendance\_date, facility, department, marked\_by, marked\_at, shift, employees: \[{employee\_id, employee\_code, employee\_name, attendance\_status, remarks}] }`
Creates header + detail rows.
Response: `{ success, header\_id }`

### `GET /api/attendance/check`

Query: `facility`, `department`, `attendance\_date`, `supervisor\_name`, `shift`
Returns latest submission status for that combination.
Response: `{ submitted, marked\_by, marked\_at, request\_status, shift }`

### `GET /api/attendance/history`

Query: `facility`, `department`, `attendance\_date`, `supervisor\_name`
Returns deduplicated records for that date.
Response: `{ records: \[{ EMPLOYEE\_CODE, EMPLOYEE\_NAME, ATTENDANCE\_STATUS, REMARKS, MARKED\_BY, MARKED\_AT, FACILITY, DEPARTMENT }] }`
**IMPORTANT**: Return column names in UPPERCASE to match existing frontend field access patterns (e.g. `r.EMPLOYEE\_CODE`).

### `GET /api/attendance/history-range`

Query: `facility`, `department`, `from\_date`, `to\_date`, `supervisor\_name`
Returns deduplicated records across the date range.
Response: `{ records: \[...same as history but with ATTENDANCE\_DATE field] }`

### `POST /api/rewrite/request`

Body: `{ attendance\_date, facility, department, supervisor\_name, reason, requested\_at }`
Response: `{ success }`

### `GET /api/rewrite/list`

Returns all requests ordered by requested\_at DESC.
Response: `{ requests: \[{ request\_id, attendance\_date, facility, department, supervisor\_name, reason, request\_status, requested\_at, actioned\_by, actioned\_at }] }`

### `POST /api/rewrite/action`

Body: `{ request\_id, action: 'approve'|'reject', actioned\_by, actioned\_at }`
Updates request status.
Response: `{ success }`

### `GET /api/today-status`

Query: `attendance\_date`
Response: `{ submissions: \[{ facility, department, marked\_by, marked\_at }] }`

\---

## COMPONENT NOTES

### Login Screen

* Exact same layout as existing: split panel (brand left, form right)
* Supervisor/Manager toggle at top of form panel
* Name search dropdown with fuzzy match + keyboard navigation (arrow keys + enter)
* PIN input with show/hide toggle
* Error display below button

### Session Banner (Supervisor)

* Shows: name, facility pill, department pill, shift toggle
* Shift toggle: ☀ Day / 🌙 Night pills
* Shift switch warning modal if employees are loaded

### Mark Attendance Tab

* Date picker (today default, past dates show notice)
* Load Employees button → shows employee list
* Each employee row: name, code, status dropdown, remarks textarea (shows for non-Present/WeekOff)
* Progress bar: Present count / total with %
* Summary chips: count per status
* Quick actions: All Present / All Week Off buttons
* Search/filter bar by name or code
* Submit button → locks on success, shows banner

### History Tab

* From/To date range picker (default: last 7 days)
* Search bar by name or code
* View button → loads data
* Single day: table view (Employee | Status | Remarks)
* Multi-day: matrix view (Employee rows × Date columns, status chips)
* Status filter pills (All, Present, Week Off, Sick Leave, etc.)
* CSV download button

### Manager Portal

* Tabs: Pending | Resolved | Attendance Log
* Pending tab: request cards with approve/reject buttons, bulk approve toolbar with checkboxes
* Attendance Log tab: date picker + Daily/Matrix toggle

  * Daily mode: dept grid with submitted/missing/late cards, click to view detail
  * Matrix mode: dept rows × date columns, click chips to view detail
* Summary stat chips (clickable to filter by submitted/missing/late)
* Full CSV download button

\---

## UI/UX IMPROVEMENTS TO MAKE (on top of exact functional parity)

1. **Loading skeletons** — replace generic skeleton divs with proper shimmer skeletons that match the shape of the content (employee rows, request cards)
2. **Micro-animations** — smooth height transitions when remarks field appears/disappears. Status select change should pulse the row briefly.
3. **Mobile bottom sheet** — on mobile (<640px), the shift toggle should move to a floating bottom bar for easier thumb access
4. **Empty states** — proper illustrated empty states with contextual CTA (not just text)
5. **Toast improvements** — stack multiple toasts if needed, icon-prefixed (✓ ✗ ℹ)
6. **Offline detection** — show a banner if navigator.onLine is false
7. **Submit confirmation** — after clicking Submit, show a brief count confirmation: "Submitting 42 employees..." before the success state
8. **Matrix improvements** — sticky first column AND sticky header row simultaneously. Hover tooltip showing full status name + remarks on matrix chips.
9. **Search highlight** — highlight matching text in employee name/code when search is active
10. **Manager detail modal** — add a print/share button on the detail modal
11. **Session expiry** — if API returns 401, auto-redirect to login with a "Session expired" message instead of silent failure

\---

## CONSTANTS (lib/constants.ts)

```typescript
export const DEPARTMENTS = \[
  'B2C Forward', 'B2C Return', 'B2B Forward', 'B2B Return',
  'Inventory', 'Inward', 'Logistics', 'Ops', 'Admin'
];

export const ATTENDANCE\_STATUSES = \[
  'Present', 'LOP', 'Week Off', 'Half Day', 'Holiday',
  'Work On Holiday', 'Sick Leave', 'Paid Leave', 'Unpaid Leave',
  'Maternity Leave', 'Paternity Leave', 'Bereavement Leave', 'Compensatory Off'
];

export const FACILITIES = \['WH1', 'WH2', 'NORTH'];

export const SOUTH\_FACILITIES = \['WH1', 'WH2'];

export const STATUS\_CLASSES: Record<string, string> = {
  'Present': 'present',
  'LOP': 'absent',
  'Week Off': 'week-off',
  'Half Day': 'half',
  'Sick Leave': 'sick-leave',
  'Paid Leave': 'planned-leave',
  'Unpaid Leave': 'unplanned-leave',
  'Holiday': 'holiday',
  'Work On Holiday': 'present',
  'Maternity Leave': 'leave',
  'Paternity Leave': 'leave',
  'Bereavement Leave': 'leave',
  'Compensatory Off': 'half',
};

export const MATRIX\_CHIP\_LABELS: Record<string, \[string, string]> = {
  'Present':          \['present', 'P'],
  'LOP':              \['absent',  'LOP'],
  'Week Off':         \['week-off','WO'],
  'Half Day':         \['half',    '½'],
  'Holiday':          \['holiday', 'HOL'],
  'Work On Holiday':  \['present', 'WOH'],
  'Sick Leave':       \['leave',   'SL'],
  'Paid Leave':       \['leave',   'PL'],
  'Unpaid Leave':     \['absent',  'UL'],
  'Maternity Leave':  \['leave',   'ML'],
  'Paternity Leave':  \['leave',   'PL'],
  'Bereavement Leave':\['leave',   'BL'],
  'Compensatory Off': \['half',    'CO'],
};
```

\---

## CSS DESIGN TOKENS (globals.css — keep exactly)

```css
:root {
  --bg: #f5f4f0;
  --surface: #ffffff;
  --surface2: #f0efe9;
  --border: #e2e0d8;
  --border2: #d0cec4;
  --accent: #c8df20;
  --accent-d: #afc410;
  --accent-text: #2a2a00;
  --text: #1a1a1a;
  --text-2: #666;
  --text-3: #aaa;
  --danger: #d93030;
  --success: #1f9e5e;
  --warn: #c97a00;
  --r: 10px;
  --mono: 'DM Mono', monospace;
  --display: 'Syne', sans-serif;
}
```

\---

## DOCKERFILE

```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package\*.json ./
COPY prisma ./prisma/
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node\_modules ./node\_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE\_ENV production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node\_modules/.prisma ./node\_modules/.prisma
USER nextjs
EXPOSE 3000
ENV PORT 3000
CMD \["node", "server.js"]
```

\---

## DOCKER-COMPOSE

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE\_URL=${DATABASE\_URL}
      - SESSION\_SECRET=${SESSION\_SECRET}
      - NEXT\_PUBLIC\_APP\_URL=${NEXT\_PUBLIC\_APP\_URL}
    depends\_on:
      db:
        condition: service\_healthy
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES\_DB: snitch\_attendance
      POSTGRES\_USER: snitch
      POSTGRES\_PASSWORD: ${POSTGRES\_PASSWORD}
    volumes:
      - postgres\_data:/var/lib/postgresql/data
    healthcheck:
      test: \["CMD-SHELL", "pg\_isready -U snitch -d snitch\_attendance"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  postgres\_data:
```

\---

## .env.example

```
DATABASE\_URL="postgresql://snitch:password@db:5432/snitch\_attendance"
SESSION\_SECRET="replace-with-32-char-random-string"
NEXT\_PUBLIC\_APP\_URL="https://your-domain.com"
POSTGRES\_PASSWORD="replace-with-strong-password"
```

\---

## DATA MIGRATION NOTES

The following seed data must be generated from the existing Google Sheets data:

1. `supervisors` table: seed from existing Supervisors sheet (supervisor\_name, facility, department, pin, role, is\_active). Parse `departments` column if it contains comma-separated values into a text array.
2. `employees` table: seed from existing Employee\_Master sheet (employee\_code, employee\_name, facility, department, is\_active, shift). Add designation, reporting\_manager, roll\_type, gender columns (nullable — fill later).
3. `attendance\_header` + `attendance\_detail`: migrate from Snowflake. The existing Snowflake `attendance\_detail` and `attendance\_header` tables have identical column names — use a direct INSERT SELECT after connecting Prisma migrations.

Create a `prisma/seed.ts` file that:

* Reads from a `data/supervisors.csv` file (to be provided)
* Reads from a `data/employees.csv` file (to be provided)
* Upserts all rows into PG
* Is runnable via `npx prisma db seed`

\---

## PACKAGE.JSON DEPENDENCIES

```json
{
  "dependencies": {
    "next": "14.2.0",
    "react": "^18",
    "react-dom": "^18",
    "typescript": "^5",
    "@prisma/client": "^5",
    "iron-session": "^8",
    "tailwindcss": "^3",
    "autoprefixer": "^10",
    "postcss": "^8"
  },
  "devDependencies": {
    "prisma": "^5",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18"
  },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "db:migrate": "prisma migrate deploy",
    "db:seed": "ts-node --compiler-options {\\\\\\"module\\\\\\":\\\\\\"CommonJS\\\\\\"} prisma/seed.ts",
    "db:studio": "prisma studio"
  }
}
```

\---

## EXISTING index.html REFERENCE

The existing `index.html` contains the complete working frontend. Key points:

* All API calls in `const CFG = { ... }` block — replace these URLs with `/api/...` Next.js routes
* Session stored in `sessionStorage` — migrate to httpOnly cookies via iron-session, but keep client-side `session` state object for UI rendering
* `currentShift`, `currentRole`, `employees`, `submissionState` etc. — keep as React state
* The `escHtml()` utility is no longer needed in JSX (React handles this)
* The `toISTDateString()` and `toISTTimestamp()` helpers must be preserved exactly in `lib/ist.ts`
* The login name dropdown with keyboard navigation must be preserved exactly
* The shift warning modal flow: `switchShift()` → warn if employees loaded → `confirmShiftSwitch()` reads `pendingShiftSwitch` BEFORE calling `closeShiftWarnModal()` — this order matters
* History tab does NOT filter by shift (intentional)
* `COALESCE(shift, 'Day')` in dedup SQL (not empty string)

\---

## WHAT TO BUILD — STEP BY STEP

1. Scaffold Next.js 14 project with TypeScript, Tailwind, App Router
2. Set up Prisma with PostgreSQL schema above
3. Create `lib/` utilities (db.ts, auth.ts, ist.ts, constants.ts)
4. Build all API routes with exact specs above
5. Build all components starting from shared (Toast, Modal, Topbar)
6. Build Login page with name dropdown, PIN input, role toggle
7. Build Supervisor page: SessionBanner + ShiftToggle, Mark tab, History tab
8. Build Manager page: Requests tab (pending/resolved), Attendance Log tab (daily/matrix)
9. Set up middleware for route protection
10. Create Dockerfile + docker-compose.yml
11. Create prisma/seed.ts for data migration
12. Write a `DEPLOY.md` with step-by-step Coolify deployment instructions

\---

## DEPLOY.md CONTENTS TO GENERATE

Include instructions for:

1. Fork/clone repo to server or connect GitHub to Coolify
2. Create Coolify PostgreSQL service
3. Set environment variables in Coolify
4. Run `npx prisma migrate deploy` on first deploy
5. Export CSVs from Google Sheets (exact column order for seed script)
6. Export attendance data from Snowflake as CSVs for migration
7. Run seed script
8. DNS/domain setup
9. How to update Maplemonk connection to point at PostgreSQL instead of Snowflake (connection string format for direct PG connection)

\---

## NOTES FOR CLAUDE CODE

* Do not use `any` in TypeScript — fully type everything
* All Prisma queries use the singleton from `lib/db.ts`
* All server timestamps use IST helper from `lib/ist.ts`
* API routes must return UPPERCASE column names in history responses (frontend depends on `r.EMPLOYEE\_CODE` not `r.employeeCode`)
* Every API route needs proper error handling with `try/catch` and meaningful error messages
* Use `next/headers` cookies for session, not localStorage
* The app must work without JavaScript disabled? No — it's a SPA, JS required is fine
* Do not install unnecessary dependencies — keep the bundle lean
* All forms are uncontrolled React with refs or controlled with useState — no form libraries
* No UI component libraries (shadcn, MUI etc.) — build from scratch using Tailwind + existing CSS vars


\---



\## ADDITIONAL FEATURES (build these on top of everything above)



\### 1. Request isolation by facility

Edit/rewrite requests must be scoped to the manager's facility.

\- South manager (WH1/WH2) sees ONLY requests from WH1/WH2 supervisors

\- North manager sees ONLY requests from NORTH supervisors

\- In `GET /api/rewrite/list`: filter by facility. If isSouth, filter `WHERE facility IN ('WH1','WH2')`, else `WHERE facility = $facility`

\- Pass manager's facility from their session on every request list call



\### 2. Bulk employee upload (Admin + Manager)

Add a "Bulk Upload" button in the Manager portal under a new "Employees" tab.

\- Accepts a CSV file with columns: employee\_code, employee\_name, facility, department, is\_active, shift, designation, reporting\_manager, roll\_type, gender

\- Shows a preview table of parsed rows before confirming

\- On confirm: upserts into employees table (INSERT ... ON CONFLICT (employee\_code) DO UPDATE)

\- Shows result: X inserted, Y updated, Z errors

\- Also add a Download Template button that downloads a blank CSV with correct headers

\- API route: POST /api/employees/bulk-upload



\### 3. Report downloads

Add a Reports section in the Manager portal (new tab: "Reports"):



Report 1 — Daily Attendance Summary (mirrors the email report format):

\- Date picker + Shift selector

\- Shows: total active, facilities count, on roll vs off roll split, gender split, present %, absenteeism %

\- Department-level breakdown: total count, P, WO, SL, PL, UL, A, Half Day

\- Download as CSV



Report 2 — Date Range Attendance (raw grain):

\- From/To date picker, facility filter, department filter, shift filter

\- Returns all attendance\_detail rows deduplicated for that range

\- Download as CSV



Report 3 — Employee Master:

\- Full list of active employees with all columns

\- Download as CSV



API routes:

\- GET /api/reports/daily-summary?date=\&shift=\&facility=

\- GET /api/reports/range?from\_date=\&to\_date=\&facility=\&department=\&shift=

\- GET /api/reports/employees?facility=



\### 4. Admin role

A new role: `admin` (stored in supervisors.role column, value = 'admin').

Only 2 users will ever have this role — one for North, one for WH1/WH2.



Admin capabilities:

\- Can VIEW attendance for every department in their facility (not just their own)

\- Can MARK attendance for any department in their facility (department selector shown on Mark tab)

\- Can RAISE edit requests for any department in their facility

\- Can APPROVE/REJECT edit requests (same as manager, but scoped to their facility)

\- Has access to all Reports for their facility

\- Has access to bulk employee upload

\- Does NOT see the other facility's data (North admin sees only North, South admin sees only WH1/WH2)



UI changes for Admin:

\- Session banner shows a department DROPDOWN instead of a fixed pill — admin can switch department without logging out

\- The dropdown lists all DEPARTMENTS constant values for their facility

\- Switching department clears the employee panel (same as shift switch — warn if employees loaded)

\- Admin login goes to a combined view (supervisor + manager tabs in one screen)



In auth: role === 'admin' → goes to /admin page (new route)

Create: app/admin/page.tsx — combines supervisor Mark/History panels + manager Requests/Log panels in one unified view with a tab bar showing all 4 tabs.

