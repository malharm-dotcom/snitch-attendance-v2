export const DEPARTMENTS = [
  'B2C Forward', 'B2C Return', 'B2B Forward', 'B2B Return',
  'Inventory', 'Inward', 'Logistics', 'Ops', 'Admin',
];

export const ATTENDANCE_STATUSES = [
  'Present', 'LOP', 'Week Off', 'Half Day', 'Holiday',
  'Work On Holiday', 'Sick Leave', 'Paid Leave', 'Unpaid Leave',
  'Maternity Leave', 'Paternity Leave', 'Bereavement Leave', 'Compensatory Off',
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
  'Maternity Leave': 'leave',
  'Paternity Leave': 'leave',
  'Bereavement Leave': 'leave',
  'Compensatory Off': 'half',
};

export const MATRIX_CHIP_LABELS: Record<string, [string, string]> = {
  'Present':           ['present', 'P'],
  'LOP':               ['absent',  'LOP'],
  'Week Off':          ['week-off','WO'],
  'Half Day':          ['half',    '½'],
  'Holiday':           ['holiday', 'HOL'],
  'Work On Holiday':   ['present', 'WOH'],
  'Sick Leave':        ['leave',   'SL'],
  'Paid Leave':        ['leave',   'PL'],
  'Unpaid Leave':      ['absent',  'UL'],
  'Maternity Leave':   ['leave',   'ML'],
  'Paternity Leave':   ['leave',   'PL'],
  'Bereavement Leave': ['leave',   'BL'],
  'Compensatory Off':  ['half',    'CO'],
};
