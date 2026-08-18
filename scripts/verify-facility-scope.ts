/**
 * Regression guard for the facility-scoping refactor.
 *
 * For every existing (non-all-access) user, the facility predicate produced by
 * lib/facilityScope.ts must be IDENTICAL to the hand-rolled expression each route used
 * before the refactor. This script reproduces the pre-refactor expressions verbatim and
 * diffs them against the helper's output for WH1, WH2 and NORTH.
 *
 * It also prints the new all-access rows, which have no "before" to compare against.
 *
 * Run:  npx ts-node --compiler-options {"module":"CommonJS"} scripts/verify-facility-scope.ts
 */
import type { SessionData } from '../lib/auth';
import {
  ALL_FACILITIES,
  resolveFacilityScope,
  facilityPrismaFilter,
  facilitySqlIn,
  facilitySqlList,
} from '../lib/facilityScope';

/* ------------------------------------------------- pre-refactor expressions (verbatim) */

const oldIsSouth = (facility: string) => facility === 'WH1' || facility === 'WH2';

/** A2/A3/A4/A8/A9/A10 + B1/B2: Prisma `where.facility` */
function oldPrismaFilter(facility: string) {
  return oldIsSouth(facility) ? { in: ['WH1', 'WH2'] } : { equals: facility };
}

/** A5 + B3/B4/B5/B6: interpolated raw-SQL clause on h2.facility */
function oldSqlClause(facility: string) {
  return oldIsSouth(facility)
    ? `h2.facility IN ('WH1','WH2')`
    : `h2.facility = '${facility.replace(/'/g, "''")}'`;
}

/** A6: in-JS scope list */
function oldScopeFacilities(facility: string) {
  return oldIsSouth(facility) ? ['WH1', 'WH2'] : [facility];
}

/** A7: quoted list spliced into `TRIM(e.facility) IN (...)` */
function oldFacList(facility: string) {
  return oldScopeFacilities(facility)
    .map((f) => `'${f.replace(/'/g, "''")}'`)
    .join(',');
}

/** A6/A7 report header label */
function oldScopeLabel(facility: string) {
  return oldIsSouth(facility) ? 'South (WH1 + WH2)' : oldScopeFacilities(facility)[0];
}

/* ------------------------------------------------------------------------------ harness */

function session(over: Partial<SessionData>): SessionData {
  return {
    supervisorName: 'test',
    facility: 'WH1',
    department: 'Ops',
    departments: ['Ops'],
    role: 'manager',
    isLoggedIn: true,
    ...over,
  };
}

let failures = 0;

function check(who: string, what: string, before: unknown, after: unknown) {
  const b = JSON.stringify(before);
  const a = JSON.stringify(after);
  const same = b === a;
  if (!same) failures++;
  console.log(
    `${same ? '  =' : '  X'} ${who.padEnd(6)} ${what.padEnd(22)} ${same ? b : `\n      before: ${b}\n      after:  ${a}`}`,
  );
}

console.log('\n=== EXISTING USERS (non-all-access) — expect every row to read "=" (no change)\n');

for (const facility of ['WH1', 'WH2', 'NORTH']) {
  const s = session({ facility });
  const scope = resolveFacilityScope(s);
  console.log(`--- ${facility}`);
  check(facility, 'prisma where.facility', oldPrismaFilter(facility), facilityPrismaFilter(scope));
  check(facility, 'raw SQL clause', oldSqlClause(facility), facilitySqlIn('h2.facility', scope));
  check(facility, 'scope facility list', oldScopeFacilities(facility), scope.allowed);
  check(facility, 'IN (...) list', oldFacList(facility), facilitySqlList(scope));
  check(facility, 'report scope label', oldScopeLabel(facility), scope.label);
  check(facility, 'write target facility', facility, scope.active);
  console.log('');
}

console.log('=== ALL-ACCESS USERS (new behaviour — no "before" exists)\n');

for (const selected of ['WH1', 'WH2', 'NORTH', ALL_FACILITIES]) {
  const scope = resolveFacilityScope(session({ facility: 'WH1', allFacilities: true, selectedFacility: selected }));
  console.log(
    `  ${selected.padEnd(8)} allowed=${JSON.stringify(scope.allowed).padEnd(18)} ` +
      `active=${String(scope.active).padEnd(7)} writable=${scope.active !== null}  sql=${facilitySqlIn('h2.facility', scope)}`,
  );
}

console.log('\n=== ISOLATION ASSERTIONS\n');

const assertions: [string, boolean][] = [
  ['NORTH user never sees WH1/WH2', !resolveFacilityScope(session({ facility: 'NORTH' })).allowed.some((f) => f !== 'NORTH')],
  ['South user never sees NORTH', !resolveFacilityScope(session({ facility: 'WH1' })).allowed.includes('NORTH')],
  ['North_Wh ghost rows outside every scope',
    (['WH1', 'WH2', 'NORTH'] as const).every((f) => !resolveFacilityScope(session({ facility: f })).allowed.includes('North_Wh')) &&
    !resolveFacilityScope(session({ facility: 'WH1', allFacilities: true, selectedFacility: ALL_FACILITIES })).allowed.includes('North_Wh')],
  ['allowed set is never empty', (['WH1', 'WH2', 'NORTH'] as const).every((f) => resolveFacilityScope(session({ facility: f })).allowed.length > 0)],
  ['__all__ is not writable', resolveFacilityScope(session({ facility: 'WH1', allFacilities: true, selectedFacility: ALL_FACILITIES })).active === null],
  ['non-all-access ignores a forged selectedFacility',
    resolveFacilityScope(session({ facility: 'NORTH', selectedFacility: 'WH1' })).allowed.join() === 'NORTH'],
  ['all-access falls back to home facility on an unknown selection',
    resolveFacilityScope(session({ facility: 'NORTH', allFacilities: true, selectedFacility: 'North_Wh' })).allowed.join() === 'NORTH'],
];

for (const [name, ok] of assertions) {
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}\n`);
process.exit(failures === 0 ? 0 : 1);
