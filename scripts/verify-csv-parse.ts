/**
 * Guard for lib/csv.ts, used by the OT bulk import.
 *
 * The OT `reason` column is free text and routinely contains commas. The employee
 * bulk-upload's `line.split(',')` would shift every later column and silently import
 * a corrupted row — this checks the quote-aware parser does not.
 *
 * Run:  npx ts-node --compiler-options {"module":"CommonJS"} scripts/verify-csv-parse.ts
 */
import { splitCsvLine, parseCsv } from '../lib/csv';

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
}
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

check('plain fields', eq(splitCsvLine('a,b,c'), ['a', 'b', 'c']));
check('quoted field with a comma',
  eq(splitCsvLine('SAPL1,2026-09-01,2,"Peak dispatch, extra picking"'),
     ['SAPL1', '2026-09-01', '2', 'Peak dispatch, extra picking']));
check('escaped double quote',
  eq(splitCsvLine('a,"he said ""go""",c'), ['a', 'he said "go"', 'c']));
check('empty trailing field', eq(splitCsvLine('a,b,'), ['a', 'b', '']));
check('surrounding whitespace trimmed', eq(splitCsvLine(' a , b '), ['a', 'b']));

// The failure this parser exists to prevent.
const naive = 'SAPL1,2026-09-01,2,"Peak dispatch, extra picking"'.split(',');
check('naive split WOULD have corrupted the row', naive.length === 5,
  `(naive gives ${naive.length} fields, correct is 4)`);

const doc = [
  'employee_code,ot_date,ot_hours,reason',
  'SAPL00070,2026-09-01,2.5,"Peak dispatch, extra picking"',
  '',
  'SAPL00516,2026-09-02,1.5,Inbound backlog',
].join('\n');
const rows = parseCsv(doc);
check('parses 2 rows, skipping the blank line', rows.length === 2, `(got ${rows.length})`);
check('comma inside reason survives', rows[0].reason === 'Peak dispatch, extra picking',
  `(got "${rows[0].reason}")`);
check('ot_hours column not shifted', rows[0].ot_hours === '2.5', `(got "${rows[0].ot_hours}")`);
check('headers lower-cased', eq(Object.keys(rows[0]).sort(),
  ['employee_code', 'ot_date', 'ot_hours', 'reason']));
check('CRLF handled', parseCsv('a,b\r\n1,2').length === 1);
check('header-only file yields no rows', parseCsv('employee_code,ot_date').length === 0);
check('empty input yields no rows', parseCsv('').length === 0);

// Round trip: what downloadSample() writes must parse back to what it meant.
const sample = 'employee_code,ot_date,ot_hours,reason\n"SAPL00001","2026-09-03","2","Peak dispatch, extra picking"';
const back = parseCsv(sample);
check('sample template round-trips', back[0].employee_code === 'SAPL00001'
  && back[0].ot_hours === '2' && back[0].reason === 'Peak dispatch, extra picking');

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}\n`);
process.exit(failures === 0 ? 0 : 1);
