/**
 * Guard for the Employee View roll-type filter hygiene (lib/reporting.ts).
 *
 * The stored employees.roll_type column is dirty: "Off-Role" and "Off-Roll" both
 * exist upstream, and legacy rows are NULL. The Employee View dropdown filters on
 * this column, so every variant must collapse onto ONE option or the filter silently
 * hides employees.
 *
 * Run:  npx ts-node --compiler-options {"module":"CommonJS"} scripts/verify-roll-type.ts
 */
import { normalizeRollType, NOT_SPECIFIED } from '../lib/reporting';

const cases: [string | null | undefined, string][] = [
  ['Off-Roll', 'Off-Roll'],
  ['Off-Role', 'Off-Roll'],
  ['off-role', 'Off-Roll'],
  ['OFF ROLL', 'Off-Roll'],
  ['Off_Roll', 'Off-Roll'],
  ['  Off-Role  ', 'Off-Roll'],
  ['On-Roll', 'On-Roll'],
  ['on role', 'On-Roll'],
  [null, NOT_SPECIFIED],
  [undefined, NOT_SPECIFIED],
  ['', NOT_SPECIFIED],
  ['   ', NOT_SPECIFIED],
  ['Contract', 'Contract'], // unknown values stay visible rather than being merged
];

let failures = 0;
for (const [input, expected] of cases) {
  const got = normalizeRollType(input);
  const ok = got === expected;
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${JSON.stringify(input)} -> ${got}${ok ? '' : ` (expected ${expected})`}`);
}

// The whole point: the two spellings must land on ONE dropdown entry.
const collapsed = new Set(['Off-Roll', 'Off-Role'].map(normalizeRollType));
const ok = collapsed.size === 1;
if (!ok) failures++;
console.log(`  ${ok ? 'PASS' : 'FAIL'}  "Off-Role"/"Off-Roll" produce a single dropdown option`);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}\n`);
process.exit(failures === 0 ? 0 : 1);
