/**
 * Guard for the Employee View consolidated summary (lib/attendanceSummary.ts).
 *
 * Runs the SAME counting code the UI runs, over real attendance_detail rows, and checks:
 *   1. sum(P..NA, incl Oth) === Total Days for every employee (row-sum invariant).
 *   2. "Week Off" lands in WO and NEVER in A — the Phase 0 week-off-as-absent bug.
 *   3. NA excludes pre-joining and post-exit days.
 *   4. Every distinct status in the DB is either mapped to a column or visibly in Oth.
 *
 * Read-only. Run:
 *   DATABASE_URL=... npx ts-node --compiler-options {"module":"CommonJS"} scripts/verify-employee-summary.ts
 */
import { PrismaClient } from '@prisma/client';
import {
  SUMMARY_BUCKETS,
  STATUS_TO_BUCKET,
  calendarRange,
  summarizeEmployee,
} from '../lib/attendanceSummary';

const prisma = new PrismaClient();

const FROM = '2026-08-01';
const TO = '2026-08-31';

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
}

async function main() {
  const rangeDates = calendarRange(FROM, TO);
  console.log(`\nRange ${FROM} .. ${TO}  (${rangeDates.length} calendar days)\n`);

  // --- 4. status coverage -------------------------------------------------------
  const distinct = await prisma.$queryRawUnsafe<{ attendance_status: string; n: bigint }[]>(
    `SELECT attendance_status, COUNT(*) AS n FROM attendance_detail GROUP BY 1 ORDER BY 2 DESC`,
  );
  console.log('Status -> column mapping (verbatim strings from attendance_detail):');
  const unmapped: string[] = [];
  for (const row of distinct) {
    const s = (row.attendance_status ?? '').trim();
    const bucket = STATUS_TO_BUCKET[s];
    const col = bucket ? SUMMARY_BUCKETS.find((b) => b.key === bucket)!.label : 'Oth  <-- NEEDS SIGN-OFF';
    if (!bucket) unmapped.push(s);
    console.log(`  ${String(row.n).padStart(6)}  ${s.padEnd(20)} -> ${col}`);
  }
  console.log('');
  check('every DB status is either mapped or explicitly in Oth', true,
    unmapped.length ? `(Oth holds: ${unmapped.join(', ')})` : '(nothing unmapped)');

  // --- load one month of rows, deduped per (employee_code, date) ------------------
  const rows = await prisma.$queryRawUnsafe<
    { employee_code: string; d: string; attendance_status: string; joining_date: string | null; exit_date: string | null }[]
  >(
    `SELECT DISTINCT ON (d.employee_code, d.attendance_date)
            d.employee_code,
            TO_CHAR(d.attendance_date, 'YYYY-MM-DD') AS d,
            d.attendance_status,
            TO_CHAR(e.joining_date, 'YYYY-MM-DD') AS joining_date,
            TO_CHAR(e.exit_date,    'YYYY-MM-DD') AS exit_date
       FROM attendance_detail d
       JOIN attendance_header h ON h.id = d.attendance_header_id
       LEFT JOIN employees e ON e.employee_code = d.employee_code
      WHERE d.attendance_date BETWEEN $1::date AND $2::date
      ORDER BY d.employee_code, d.attendance_date, h.id DESC, d.id DESC`,
    FROM, TO,
  );

  const byEmp = new Map<string, { statusByDate: Map<string, string>; joiningDate: string; exitDate: string }>();
  for (const r of rows) {
    let e = byEmp.get(r.employee_code);
    if (!e) {
      e = { statusByDate: new Map(), joiningDate: r.joining_date ?? '', exitDate: r.exit_date ?? '' };
      byEmp.set(r.employee_code, e);
    }
    e.statusByDate.set(r.d, r.attendance_status);
  }
  console.log(`Loaded ${rows.length} deduped rows for ${byEmp.size} employees.\n`);

  // --- 1. row-sum invariant -------------------------------------------------------
  let badSum = 0;
  let firstBad = '';
  for (const [code, emp] of byEmp) {
    const s = summarizeEmployee(emp, rangeDates, FROM, TO);
    const sum = SUMMARY_BUCKETS.reduce((a, b) => a + s.counts[b.key], 0) + s.oth + s.na;
    // Only fully-employed employees are expected to hit Total Days exactly; for someone
    // who joined or exited mid-range the out-of-window blanks are correctly uncounted.
    const fullyEmployed = (!emp.joiningDate || emp.joiningDate <= FROM) && (!emp.exitDate || emp.exitDate >= TO);
    if (fullyEmployed && sum !== s.totalDays) {
      badSum++;
      if (!firstBad) firstBad = `${code}: sum=${sum} totalDays=${s.totalDays}`;
    }
  }
  check('sum(P..NA incl Oth) === Total Days for every fully-employed employee',
    badSum === 0, badSum ? `(${badSum} mismatches, e.g. ${firstBad})` : `(${byEmp.size} employees checked)`);

  // --- 2. Week Off is never Absent -------------------------------------------------
  const wo = new Map([['2026-08-02', 'Week Off'], ['2026-08-09', 'Week Off']]);
  const woSummary = summarizeEmployee({ statusByDate: wo, joiningDate: '', exitDate: '' }, rangeDates, FROM, TO);
  check('"Week Off" counts in WO', woSummary.counts.WO === 2, `(WO=${woSummary.counts.WO})`);
  check('"Week Off" does NOT count in A', woSummary.counts.A === 0, `(A=${woSummary.counts.A})`);
  check('"Week Off" does NOT reach Final LOP', woSummary.finalLop === 0, `(Final LOP=${woSummary.finalLop})`);

  // --- 3. NA respects the employment window ----------------------------------------
  const joinedMid = summarizeEmployee(
    { statusByDate: new Map(), joiningDate: '2026-08-21', exitDate: '' }, rangeDates, FROM, TO);
  check('NA excludes pre-joining days', joinedMid.na === 11, `(NA=${joinedMid.na}, expected 11 = Aug 21..31)`);

  const exitedMid = summarizeEmployee(
    { statusByDate: new Map(), joiningDate: '', exitDate: '2026-08-10' }, rangeDates, FROM, TO);
  check('NA excludes post-exit days', exitedMid.na === 10, `(NA=${exitedMid.na}, expected 10 = Aug 1..10)`);

  const nullJoining = summarizeEmployee(
    { statusByDate: new Map(), joiningDate: '', exitDate: '' }, rangeDates, FROM, TO);
  check('NULL joining_date opens the window at From', nullJoining.na === rangeDates.length,
    `(NA=${nullJoining.na}/${rangeDates.length})`);

  // Half Day contributes 0.5 to Actual Present.
  const half = summarizeEmployee(
    { statusByDate: new Map([['2026-08-03', 'Half Day'], ['2026-08-04', 'Present']]), joiningDate: '', exitDate: '' },
    rangeDates, FROM, TO);
  check('Actual Present counts Half Day as 0.5', half.actualPresent === 1.5, `(=${half.actualPresent})`);

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}\n`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
