import { SOUTH_FACILITIES } from './constants';

/** Human-readable facility scope for header bands. Mirrors server isSouth(). */
export function scopeLabel(facility: string): string {
  return SOUTH_FACILITIES.includes(facility) ? 'South (WH1 + WH2)' : facility;
}

/** Filename-safe scope slug: South collapses to SOUTH, NORTH stays NORTH. */
export function scopeSlug(facility: string): string {
  return SOUTH_FACILITIES.includes(facility) ? 'SOUTH' : facility;
}

/** Shared filename convention, e.g. reportFilename('attendance-rate','NORTH','2026-07-14','png'). */
export function reportFilename(base: string, scope: string, suffix: string, ext: string): string {
  return `${base}_${scope}_${suffix}.${ext}`;
}
