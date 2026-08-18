import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { resolveFacilityScope } from '@/lib/facilityScope';
import {
  GENDERS,
  ROLL_TYPES,
  normalizeGender,
  normalizeShift,
  normalizeFacility,
  rollTypeFromCode,
  NOT_SPECIFIED,
} from '@/lib/reporting';

export interface PivotRowOut {
  label: string;
  /** For the dept+designation level: parent department (rows nest under it). */
  group?: string;
  /** True for the bold per-department Subtotal row. */
  isSubtotal?: boolean;
  counts: Record<string, number>;
  total: number;
}

export interface PivotOut {
  columns: string[];
  rows: PivotRowOut[];
  columnTotals: Record<string, number>;
  grandTotal: number;
}

interface Emp {
  code: string;
  department: string;
  designation: string;
  shift: string;
  gender: string;
  rollType: string;
}

/** Distinct-employee pivot: rows keyed by rowKey(e), columns by colKey(e). */
function buildPivot(
  emps: Emp[],
  columns: string[],
  rowKey: (e: Emp) => string,
  colKey: (e: Emp) => string,
  rowOrder?: readonly string[]
): PivotOut {
  // Distinct employee codes per (row, col) cell — codes are unique per employee,
  // but guard with Sets so duplicates can never inflate counts.
  const cells = new Map<string, Map<string, Set<string>>>();
  for (const e of emps) {
    const r = rowKey(e);
    const c = colKey(e);
    if (!cells.has(r)) cells.set(r, new Map());
    const row = cells.get(r)!;
    if (!row.has(c)) row.set(c, new Set());
    row.get(c)!.add(e.code);
  }

  const rowLabels = Array.from(cells.keys()).sort((a, b) => {
    // Explicit order wins (e.g. On-Roll before Off-Roll); "Not specified" always last
    if (rowOrder) {
      const ia = rowOrder.indexOf(a);
      const ib = rowOrder.indexOf(b);
      if (ia !== -1 || ib !== -1) return (ia === -1 ? rowOrder.length : ia) - (ib === -1 ? rowOrder.length : ib);
    }
    if (a === NOT_SPECIFIED) return 1;
    if (b === NOT_SPECIFIED) return -1;
    return a.localeCompare(b);
  });

  const columnTotals: Record<string, number> = Object.fromEntries(columns.map((c) => [c, 0]));
  let grandTotal = 0;

  const rows: PivotRowOut[] = rowLabels.map((label) => {
    const counts: Record<string, number> = {};
    let total = 0;
    for (const c of columns) {
      const n = cells.get(label)!.get(c)?.size ?? 0;
      counts[c] = n;
      columnTotals[c] += n;
      total += n;
    }
    grandTotal += total;
    return { label, counts, total };
  });

  return { columns, rows, columnTotals, grandTotal };
}

/** Row totals + column totals must both reconcile to the grand total. */
function assertReconciles(name: string, p: PivotOut, expectedGrandTotal: number) {
  const rowSum = p.rows.filter((r) => !r.isSubtotal).reduce((a, r) => a + r.total, 0);
  const colSum = Object.values(p.columnTotals).reduce((a, b) => a + b, 0);
  if (rowSum !== p.grandTotal || colSum !== p.grandTotal || p.grandTotal !== expectedGrandTotal) {
    throw new Error(
      `Pivot "${name}" does not reconcile: rowSum=${rowSum} colSum=${colSum} grandTotal=${p.grandTotal} expected=${expectedGrandTotal}`
    );
  }
}

// Separator used to build compound dept+designation keys. Dept names contain
// spaces, so use a control character that can never appear in the data.
const SEP = '\u001f';

export async function GET() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !['manager', 'admin'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Facility scope derived server-side from the session, never from params.
    const scope = resolveFacilityScope(session);
    const scopeFacilities = scope.allowed.map(normalizeFacility);
    const scopeLabel = scope.label;

    const raw = await prisma.employee.findMany({
      where: { isActive: true },
      select: {
        employeeCode: true,
        facility: true,
        department: true,
        designation: true,
        shift: true,
        gender: true,
      },
    });

    const emps: Emp[] = raw
      .filter((e) => scopeFacilities.includes(normalizeFacility(e.facility)))
      .map((e) => ({
        code: e.employeeCode,
        department: (e.department ?? '').trim() || NOT_SPECIFIED,
        designation: (e.designation ?? '').trim() || NOT_SPECIFIED,
        shift: normalizeShift(e.shift),
        gender: normalizeGender(e.gender),
        rollType: rollTypeFromCode(e.employeeCode),
      }));

    const totalActive = new Set(emps.map((e) => e.code)).size;

    const genderCols = GENDERS.filter((g) => g !== NOT_SPECIFIED || emps.some((e) => e.gender === NOT_SPECIFIED));
    const rollCols = [...ROLL_TYPES];

    const rollGender = buildPivot(emps, [...genderCols], (e) => e.rollType, (e) => e.gender, ROLL_TYPES);
    const shiftGender = buildPivot(emps, [...genderCols], (e) => e.shift, (e) => e.gender);
    const deptRoll = buildPivot(emps, rollCols, (e) => e.department, (e) => e.rollType);

    // Dept + Designation × Roll Type: designation rows nested under department,
    // with a bold per-department Subtotal row.
    const deptDesig: PivotOut = { columns: rollCols, rows: [], columnTotals: {}, grandTotal: 0 };
    {
      const flat = buildPivot(emps, rollCols, (e) => e.department + SEP + e.designation, (e) => e.rollType);
      deptDesig.columnTotals = flat.columnTotals;
      deptDesig.grandTotal = flat.grandTotal;

      const byDept = new Map<string, PivotRowOut[]>();
      for (const r of flat.rows) {
        const [dept, desig] = r.label.split(SEP);
        if (!byDept.has(dept)) byDept.set(dept, []);
        byDept.get(dept)!.push({ label: desig, group: dept, counts: r.counts, total: r.total });
      }
      const depts = Array.from(byDept.keys()).sort((a, b) =>
        a === NOT_SPECIFIED ? 1 : b === NOT_SPECIFIED ? -1 : a.localeCompare(b)
      );
      for (const dept of depts) {
        const children = byDept.get(dept)!;
        const subCounts: Record<string, number> = Object.fromEntries(rollCols.map((c) => [c, 0]));
        let subTotal = 0;
        for (const ch of children) {
          for (const c of rollCols) subCounts[c] += ch.counts[c];
          subTotal += ch.total;
        }
        // Subtotal row leads the group — it doubles as the department header
        // and carries the collapse toggle in the UI.
        deptDesig.rows.push({ label: 'Subtotal', group: dept, isSubtotal: true, counts: subCounts, total: subTotal });
        deptDesig.rows.push(...children);
      }
    }

    assertReconciles('rollGender', rollGender, totalActive);
    assertReconciles('shiftGender', shiftGender, totalActive);
    assertReconciles('deptRoll', deptRoll, totalActive);
    assertReconciles('deptDesig', deptDesig, totalActive);

    return NextResponse.json({
      scope: scopeLabel,
      totalActive,
      pivots: {
        'roll-gender': rollGender,
        'shift-gender': shiftGender,
        'dept-roll': deptRoll,
        'dept-desig': deptDesig,
      },
    });
  } catch (error) {
    console.error('GET /api/reports/manpower-summary error:', error);
    return NextResponse.json({ error: (error as Error).message ?? 'Failed to generate manpower summary' }, { status: 500 });
  }
}
