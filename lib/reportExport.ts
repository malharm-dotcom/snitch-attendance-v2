import { SOUTH_FACILITIES } from './constants';

/** Mirrors lib/facilityScope.ts ALL_FACILITIES — client-side label rendering only. */
export const ALL_FACILITIES = '__all__';

/** Human-readable facility scope for header bands. Mirrors server resolveFacilityScope().label. */
export function scopeLabel(facility: string): string {
  if (facility === ALL_FACILITIES) return 'All facilities';
  return SOUTH_FACILITIES.includes(facility) ? 'South (WH1 + WH2)' : facility;
}

/** Filename-safe scope slug: South collapses to SOUTH, NORTH stays NORTH. */
export function scopeSlug(facility: string): string {
  if (facility === ALL_FACILITIES) return 'ALL';
  return SOUTH_FACILITIES.includes(facility) ? 'SOUTH' : facility;
}

/** Shared filename convention, e.g. reportFilename('attendance-rate','NORTH','2026-07-14','png'). */
export function reportFilename(base: string, scope: string, suffix: string, ext: string): string {
  return `${base}_${scope}_${suffix}.${ext}`;
}
