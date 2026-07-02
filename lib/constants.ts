export const ATTENDANCE_CUTOFF_HOUR_IST = 23; // 11 PM IST — change here to adjust globally

export const DEPARTMENTS = [
  'B2C Forward', 'B2C Return', 'B2B Forward', 'B2B Return',
  'Inventory', 'Inward', 'Logistics', 'Ops', 'Admin',
];

export const ATTENDANCE_STATUSES = [
  'Present', 'LOP', 'Week Off', 'Half Day', 'Holiday',
  'Work On Holiday', 'Work on Week Off', 'Sick Leave', 'Paid Leave', 'Unpaid Leave',
  'Maternity Leave', 'Paternity Leave', 'Bereavement Leave', 'Compensatory Off', 'Absconding',
];

export const FACILITIES = ['WH1', 'WH2', 'NORTH'];

export const SOUTH_FACILITIES = ['WH1', 'WH2'];

export const STATUS_CLASSES: Record<string, string> = {
  'Present': 'present',
  'LOP': 'absent',
  'Week Off': 'week-off',
  'Half Day': 'half',
  'Sick Leave': 'sick-leave',
  'Paid Leave': 'planned-leave',
  'Unpaid Leave': 'unplanned-leave',
  'Holiday': 'holiday',
  'Work On Holiday': 'present',
  'Work on Week Off': 'present',
  'Maternity Leave': 'leave',
  'Paternity Leave': 'leave',
  'Bereavement Leave': 'leave',
  'Compensatory Off': 'half',
  'Absconding': 'absent',
};

export const MATRIX_CHIP_LABELS: Record<string, [string, string]> = {
  'Present':           ['present', 'P'],
  'Absent':            ['absent',  'A'],
  'LOP':               ['absent',  'LOP'],
  'Week Off':          ['week-off','WO'],
  'Half Day':          ['half',    '½'],
  'Holiday':           ['holiday', 'HOL'],
  'Work On Holiday':   ['present', 'WOH'],
  'Work on Week Off':  ['present', 'WOW'],
  'Sick Leave':        ['leave',   'SL'],
  'Paid Leave':        ['leave',   'PL'],
  'Unpaid Leave':      ['absent',  'UL'],
  'Maternity Leave':   ['leave',   'ML'],
  'Paternity Leave':   ['leave',   'PL'],
  'Bereavement Leave': ['leave',   'BL'],
  'Compensatory Off':  ['half',    'CO'],
  'Absconding':        ['absent',  'AB'],
};

/**
 * Single source of truth for the read-only 7-day history strip on Mark Attendance.
 * Maps a full status label -> abbreviated code + text/background colors.
 * Unknown labels fall back to the first two letters uppercased in neutral grey.
 * Empty / no-record days are handled by the caller (faint dash), not here.
 */
export function stripStatusInfo(status: string): { code: string; color: string; bg: string } {
  const map: Record<string, { code: string; color: string; bg: string }> = {
    'Present':          { code: 'P',   color: '#15803d', bg: '#dcfce7' }, // green
    'Work on Week Off': { code: 'WO',  color: '#1d4ed8', bg: '#dbeafe' }, // blue
    'Week Off':         { code: 'WO',  color: '#1d4ed8', bg: '#dbeafe' }, // blue
    'Paid Leave':       { code: 'PL',  color: '#0f766e', bg: '#ccfbf1' }, // teal
    'LOP':              { code: 'LOP', color: '#b45309', bg: '#fef3c7' }, // amber
    'Unpaid Leave':     { code: 'UL',  color: '#b45309', bg: '#fef3c7' }, // amber
    'Absent':           { code: 'A',   color: '#b91c1c', bg: '#fee2e2' }, // red
    'Absconding':       { code: 'AB',  color: '#7f1d1d', bg: '#fecaca' }, // dark red
  };
  const hit = map[status];
  if (hit) return hit;
  return { code: (status || '').slice(0, 2).toUpperCase() || '?', color: '#6b7280', bg: '#f3f4f6' }; // neutral grey
}
