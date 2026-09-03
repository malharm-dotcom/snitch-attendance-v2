import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { resolveFacilityScope } from '@/lib/facilityScope';
import { parseISTDate } from '@/lib/ist';

/**
 * Bulk OT import.
 *
 * The CSV deliberately carries ONLY what the uploader is allowed to decide:
 *   employee_code, ot_date, ot_hours, reason
 *
 * facility is derived server-side from the employee's own row, and status is forced to
 * 'Pending'. Neither is importable — otherwise a spreadsheet could stamp a facility
 * outside the uploader's scope, or land OT as 'Approved' and bypass approval entirely.
 */
interface OtImportRow {
  employee_code: string;
  ot_date: string;
  ot_hours: string | number;
  reason: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Guard against a runaway paste. Rows are CREATED, not upserted, so junk is not idempotent. */
const MAX_ROWS = 2000;

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!['manager', 'admin'].includes(session.role)) {
      return NextResponse.json({ error: 'Only managers and admins can bulk import OT' }, { status: 403 });
    }

    const body: { rows: OtImportRow[] } = await request.json();
    const rows = body.rows;
    if (!rows?.length) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json({ error: `Too many rows (${rows.length}); the limit is ${MAX_ROWS}` }, { status: 400 });
    }

    const scope = resolveFacilityScope(session);
    if (!scope.active) {
      return NextResponse.json(
        { error: 'Select a specific facility before importing OT. "All facilities" is read-only.' },
        { status: 400 },
      );
    }

    const errors: { row: number; error: string }[] = [];

    // Batch the lookups: one query for every employee named in the file, one for the
    // existing pending rows. Beats a round trip per line.
    const codes = Array.from(new Set(rows.map((r) => (r.employee_code ?? '').trim()).filter(Boolean)));
    const employees = await prisma.employee.findMany({
      where: { employeeCode: { in: codes } },
      select: { employeeCode: true, facility: true },
    });
    const facilityByCode = new Map(employees.map((e) => [e.employeeCode, e.facility]));

    const existingPending = await prisma.otRequest.findMany({
      where: { employeeCode: { in: codes }, status: 'Pending' },
      select: { employeeCode: true, otDate: true },
    });
    // Re-uploading the same file must not create duplicates.
    const pendingKeys = new Set(
      existingPending.map((p) => `${p.employeeCode}|${p.otDate.toISOString().slice(0, 10)}`),
    );

    const toCreate: {
      employeeCode: string; facility: string; otDate: Date; otHours: number;
      reason: string; status: string; requestedBy: string;
    }[] = [];
    let skipped = 0;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const line = i + 2; // +1 for the header, +1 for 1-based numbering
      const code = (r.employee_code ?? '').trim();
      const otDate = String(r.ot_date ?? '').trim();
      const reason = (r.reason ?? '').trim();

      if (!code || !otDate || !reason || r.ot_hours === '' || r.ot_hours === undefined) {
        errors.push({ row: line, error: 'employee_code, ot_date, ot_hours and reason are all required' });
        continue;
      }
      if (!DATE_RE.test(otDate)) {
        errors.push({ row: line, error: `ot_date '${otDate}' must be YYYY-MM-DD` });
        continue;
      }
      const hours = Number(r.ot_hours);
      if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
        errors.push({ row: line, error: `ot_hours '${r.ot_hours}' must be between 0.5 and 24` });
        continue;
      }
      if (Math.round(hours * 2) !== hours * 2) {
        errors.push({ row: line, error: `ot_hours '${r.ot_hours}' must be in steps of 0.5` });
        continue;
      }

      const facility = facilityByCode.get(code);
      if (!facility) {
        errors.push({ row: line, error: `Unknown employee_code '${code}'` });
        continue;
      }
      if (!scope.allowed.includes(facility)) {
        errors.push({ row: line, error: `'${code}' belongs to ${facility}, outside your scope (${scope.allowed.join(', ')})` });
        continue;
      }

      const key = `${code}|${otDate}`;
      if (pendingKeys.has(key)) {
        skipped++;
        continue;
      }
      pendingKeys.add(key); // also dedups repeats WITHIN the uploaded file

      toCreate.push({
        employeeCode: code,
        facility,                       // from the employee row, never from the CSV
        otDate: parseISTDate(otDate),   // calendar date — no timezone shift
        otHours: hours,
        reason,
        status: 'Pending',              // never importable
        requestedBy: session.supervisorName,
      });
    }

    // One atomic insert for everything that validated. A row-level DB CHECK failure
    // rolls the whole batch back rather than leaving a half-applied import.
    if (toCreate.length) {
      await prisma.otRequest.createMany({ data: toCreate });
    }

    return NextResponse.json({
      success: true,
      inserted: toCreate.length,
      skipped,
      errors,
    });
  } catch (error) {
    console.error('POST /api/ot/bulk-upload error:', error);
    return NextResponse.json({ error: 'OT bulk import failed' }, { status: 500 });
  }
}
