/**
 * Shared read-time normalization + status buckets for the Reports section.
 * These NEVER mutate stored data — they normalize at read time only.
 */
import { DEPARTMENTS } from './constants';

export const NOT_SPECIFIED = 'Not specified';

/**
 * Collapse employee-side department spelling variants (e.g. "B2C RETURN") onto the
 * canonical DEPARTMENTS label so the eligible denominator lines up with the
 * header-side marked counts. Unknown departments (e.g. "MANAGER") pass through
 * trimmed so they stay visible rather than being silently merged.
 */
export function normalizeDepartment(dept: string | null | undefined): string {
  const t = (dept ?? '').trim();
  if (!t) return NOT_SPECIFIED;
  const hit = DEPARTMENTS.find((d) => d.toLowerCase() === t.toLowerCase());
  return hit ?? t;
}

/**
 * Attendance Rate buckets — single source of truth (signed off 2026-07-09).
 * Every status that can appear in attendance_detail must be in exactly one
 * bucket so Attendance% + Absenteeism% + Pending% = 100 by construction.
 * present_like = statuses where the employee is actually working that day.
 */
export const PRESENT_LIKE_STATUSES = [
  'Present',
  'Work on Week Off',
  'Work On Holiday',
  'Half Day',
] as const;

export const ABSENT_LIKE_STATUSES = [
  'Absent',
  'Absconding',
  'LOP',
  'Unpaid Leave',
  'Paid Leave',
  'Week Off',
  'Holiday',
  'Compensatory Off',
  'Planned Leave',
  'Unplanned Leave',
  'Sick Leave',
  'Bereavement Leave',
  'Maternity Leave',
  'Paternity Leave',
] as const;

const presentSet = new Set<string>(PRESENT_LIKE_STATUSES);
const absentSet = new Set<string>(ABSENT_LIKE_STATUSES);

export function classifyStatus(status: string): 'present' | 'absent' | 'unknown' {
  const s = status.trim();
  if (presentSet.has(s)) return 'present';
  if (absentSet.has(s)) return 'absent';
  return 'unknown';
}

/**
 * Roll type is DERIVED from the employee code (signed off 2026-07-09):
 * codes starting with SAPL are On-Roll, everything else is Off-Roll.
 * The stored roll_type column is intentionally ignored (it has dirty data
 * in the upstream source: "Off-Role" vs "Off-Roll").
 */
export function rollTypeFromCode(employeeCode: string): 'On-Roll' | 'Off-Roll' {
  return employeeCode.trim().toUpperCase().startsWith('SAPL') ? 'On-Roll' : 'Off-Roll';
}

export const ROLL_TYPES = ['On-Roll', 'Off-Roll'] as const;

/** Trim + title-case gender; NULL/empty/unrecognised → "Not specified". */
export function normalizeGender(gender: string | null | undefined): string {
  const g = (gender ?? '').trim().toLowerCase();
  if (g === 'male' || g === 'm') return 'Male';
  if (g === 'female' || g === 'f') return 'Female';
  return NOT_SPECIFIED;
}

export const GENDERS = ['Male', 'Female', NOT_SPECIFIED] as const;

/** Trim + title-case shift ("DAY"/"day" → "Day"); NULL/empty → "Not specified". */
export function normalizeShift(shift: string | null | undefined): string {
  const s = (shift ?? '').trim().toLowerCase();
  if (s === 'day') return 'Day';
  if (s === 'night') return 'Night';
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : NOT_SPECIFIED;
}

/**
 * Facility normalization for the Reports section: trim only.
 *
 * The former "North_Wh" -> "NORTH" fold (added 2026-07-09) was removed: those 45
 * rows are a field-swapped duplicate ghost batch (2026-05-21 load) whose columns
 * hold name-in-employee_code and GS-code-in-employee_name, and every one of them
 * duplicates an employee already present under facility='NORTH' (the GS-code twin
 * is the record actually marked daily). They are not real North staff and must not
 * fold into NORTH — folding them double-counted 28 current employees and revived
 * 17 already-exited ones, inflating NORTH active headcount to 343 vs a true 298.
 * North_Wh now normalizes to itself and falls outside every facility scope.
 */
export function normalizeFacility(facility: string): string {
  return facility.trim();
}

/** SQL expression for the same facility normalization (for raw queries). */
export const SQL_NORM_FACILITY = (col: string) => `TRIM(${col})`;
