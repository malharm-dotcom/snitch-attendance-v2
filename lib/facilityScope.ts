/**
 * SINGLE CHOKE POINT for facility scoping.
 *
 * Every facility-scoped route resolves its scope here and nowhere else. No route
 * hand-rolls `isSouth(x) ? ['WH1','WH2'] : [x]` any more, and no route reads a
 * facility from the client — the scope is derived exclusively from the session.
 *
 * Semantics (signed off Phase 0 §5.3):
 *   single-facility WH1 / WH2       -> allowed = ['WH1','WH2']   (South cross-visibility)
 *   single-facility NORTH           -> allowed = ['NORTH']       (isolated)
 *   all-access, selected WH1 / WH2  -> allowed = ['WH1','WH2']   (identical to a South user)
 *   all-access, selected NORTH      -> allowed = ['NORTH']
 *   all-access, selected __all__    -> allowed = FACILITIES whitelist
 *
 * `allowed` is ALWAYS an explicit whitelist and NEVER "no filter" / 1=1 — the
 * North_Wh ghost batch (see lib/reporting.ts normalizeFacility) must stay outside
 * every scope.
 */
import { FACILITIES, SOUTH_FACILITIES } from './constants';
// Type-only: keeps this module free of any runtime dependency on next/headers, so the
// scoping rules can be exercised standalone (see scripts/verify-facility-scope.ts).
import type { SessionData } from './auth';

/** WH1 and WH2 are adjacent buildings and cross-visible. NORTH is isolated. */
export function isSouth(facility: string): boolean {
  return SOUTH_FACILITIES.includes(facility);
}

/** Sentinel for "aggregate across every facility". Never a stored facility value. */
export const ALL_FACILITIES = '__all__';

export interface FacilityScope {
  /** The whitelist every read filters by. Never empty, never "all rows". */
  allowed: string[];
  /** The one concrete facility writes target. null only when __all__ is selected. */
  active: string | null;
  /** True when the user picked the cross-facility aggregate. */
  isAllSelected: boolean;
  /** Human-readable scope for report headers / filenames. */
  label: string;
}

/** South (WH1+WH2) cross-visibility — the one rule, applied in one place. */
function expand(facility: string): string[] {
  return isSouth(facility) ? ['WH1', 'WH2'] : [facility];
}

function labelFor(facility: string): string {
  return isSouth(facility) ? 'South (WH1 + WH2)' : facility;
}

/** True when this session may switch facilities at all. */
export function isAllAccess(session: SessionData): boolean {
  return session.allFacilities === true;
}

/**
 * The facility an all-access session currently has selected, falling back to their
 * home facility. Unknown values fall back too, so a stale cookie can never widen scope.
 */
function selectionOf(session: SessionData): string {
  const sel = session.selectedFacility;
  if (!sel) return session.facility;
  if (sel === ALL_FACILITIES) return ALL_FACILITIES;
  return FACILITIES.includes(sel) ? sel : session.facility;
}

export function resolveFacilityScope(session: SessionData): FacilityScope {
  if (isAllAccess(session)) {
    const sel = selectionOf(session);
    if (sel === ALL_FACILITIES) {
      return { allowed: [...FACILITIES], active: null, isAllSelected: true, label: 'All facilities' };
    }
    return { allowed: expand(sel), active: sel, isAllSelected: false, label: labelFor(sel) };
  }
  // Non-all-access: byte-for-byte the pre-existing behaviour.
  return {
    allowed: expand(session.facility),
    active: session.facility,
    isAllSelected: false,
    label: labelFor(session.facility),
  };
}

/** The set of facilities this session may READ. */
export function resolveAllowedFacilities(session: SessionData): string[] {
  return resolveFacilityScope(session).allowed;
}

/** The single facility this session WRITES to. null => no concrete target (blocks writes). */
export function resolveActiveFacility(session: SessionData): string | null {
  return resolveFacilityScope(session).active;
}

/* ------------------------------------------------------------------ adapters */

/**
 * Prisma `where.facility` filter. Emits `{ equals }` for a single facility and
 * `{ in }` for a set — matching the exact shapes the routes used before this refactor.
 */
export function facilityPrismaFilter(scope: FacilityScope): { equals: string } | { in: string[] } {
  return scope.allowed.length === 1 ? { equals: scope.allowed[0] } : { in: scope.allowed };
}

/** SQL-quote a facility. Values originate from the FACILITIES whitelist, never from input. */
function q(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** Comma-separated quoted list, e.g. `'WH1','WH2'` — for callers writing their own IN (...). */
export function facilitySqlList(scope: FacilityScope): string {
  return scope.allowed.map(q).join(',');
}

/**
 * A raw-SQL facility predicate for `col`. Emits `col = 'NORTH'` for a single facility
 * and `col IN ('WH1','WH2')` for a set — matching the pre-refactor clause text.
 */
export function facilitySqlIn(col: string, scope: FacilityScope): string {
  return scope.allowed.length === 1
    ? `${col} = ${q(scope.allowed[0])}`
    : `${col} IN (${facilitySqlList(scope)})`;
}

/**
 * Guard for write paths.
 *
 * A write always targets ONE concrete facility. Two rules, in order:
 *
 *  1. If no concrete facility is active (an all-access user viewing "All facilities"),
 *     the write is refused outright — "all" is never a writable target.
 *  2. Otherwise the caller may name a facility, but ONLY one already inside the
 *     session-derived allowed set. This is what preserves South behaviour: a WH1
 *     supervisor loads WH1+WH2 employees together and each employee's attendance is
 *     stamped with their OWN facility, exactly as before. A named facility outside the
 *     allowed set is rejected — it can never widen scope, so this is not a trusted
 *     client parameter, it is a choice constrained by the server's whitelist.
 *     Omitted / unknown falls back to the active facility.
 */
export function requireWriteFacility(
  session: SessionData,
  requested?: string | null,
): { facility: string } | { error: string } {
  const scope = resolveFacilityScope(session);
  if (!scope.active) {
    return { error: 'Select a specific facility before marking attendance. "All facilities" is read-only.' };
  }
  if (requested && !scope.allowed.includes(requested)) {
    return { error: `Facility '${requested}' is outside your allowed scope (${scope.allowed.join(', ')})` };
  }
  return { facility: requested || scope.active };
}
