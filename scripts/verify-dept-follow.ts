/**
 * Guards the "attendance follows the employee" rule (2026-09-01).
 *
 * Run: npx ts-node --compiler-options {"module":"CommonJS"} scripts/verify-dept-follow.ts
 *
 * Reads are scoped by the employee's CURRENT roster department, never by the
 * attendance_header snapshot — otherwise a department move hides every day already
 * marked under the old department. No DB needed: this asserts the SQL the routes
 * build, plus the status-code table the "CSV (codes)" export depends on.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { strict as assert } from 'assert';
import { SQL_EFFECTIVE_DEPT, SQL_DEDUP_PARTITION } from '../lib/reporting';
import { ATTENDANCE_STATUSES, MATRIX_CHIP_LABELS } from '../lib/constants';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

// Every route that reads marked attendance and touches department.
const ROUTES = [
  'app/api/attendance/history/route.ts',
  'app/api/attendance/history-range/route.ts',
  'app/api/attendance/history-strip/route.ts',
  'app/api/reports/range/route.ts',
  'app/api/reports/daily-summary/route.ts',
  'app/api/reports/department-pivot/route.ts',
];

for (const route of ROUTES) {
  const src = read(route);

  // 1. No read filters or groups on the header's department snapshot any more.
  assert.equal(/h2?\.department\s*=/.test(src), false, `${route}: still filters on the header department`);
  assert.equal(/GROUP BY h\.department/.test(src), false, `${route}: still groups by the header department`);

  // 2. The dedup key is the shared one (no department, no facility) — a mid-range
  //    move must not yield two winning rows for the same employee-day.
  assert.equal(
    /PARTITION BY d2\.employee_code, d2\.attendance_date, h2\./.test(src),
    false,
    `${route}: still dedups on a header column`,
  );
}

assert.match(SQL_DEDUP_PARTITION, /^PARTITION BY d2\.employee_code, d2\.attendance_date, COALESCE\(h2\.shift,'Day'\)$/);

// Roster department wins, header snapshot is only the fallback for a deleted employee.
const expr = SQL_EFFECTIVE_DEPT('e', 'h');
assert.equal(expr, "COALESCE(NULLIF(TRIM(e.department), ''), h.department)");
assert.ok(expr.indexOf('e.department') < expr.indexOf('h.department'), 'header department must be the fallback');

// The "CSV (codes)" export prints MATRIX_CHIP_LABELS codes; a gap would silently
// fall back to the full label and produce a mixed-encoding column.
for (const s of ATTENDANCE_STATUSES) {
  assert.ok(MATRIX_CHIP_LABELS[s], `no matrix code for status "${s}"`);
}

console.log(`OK — ${ROUTES.length} routes follow the roster department; ${ATTENDANCE_STATUSES.length} statuses have codes`);
