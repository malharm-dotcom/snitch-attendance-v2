export interface HistoryRecord {
  EMPLOYEE_CODE: string;
  EMPLOYEE_NAME: string;
  ATTENDANCE_STATUS: string;
  REMARKS: string | null;
  MARKED_BY: string;
  MARKED_AT: string;
  FACILITY: string;
  DEPARTMENT: string;
  ATTENDANCE_DATE?: string;
  JOINING_DATE?: string;  // YYYY-MM-DD or '' — only present when API joins employees table
  EXIT_DATE?: string;     // YYYY-MM-DD or '' — only present when API joins employees table
}
