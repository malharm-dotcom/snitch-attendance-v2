/**
 * Migrates historical attendance data from Snowflake CSV exports to PostgreSQL.
 * Run: npx ts-node scripts/migrate-snowflake.ts
 *
 * Expected files in data/:
 *   attendance_header.csv  — columns: ID,ATTENDANCE_DATE,FACILITY,DEPARTMENT,MARKED_BY,MARKED_AT,CREATED_AT,STATUS,SHIFT
 *   attendance_detail.csv  — columns: ID,ATTENDANCE_HEADER_ID,EMPLOYEE_ID,EMPLOYEE_CODE,EMPLOYEE_NAME,ATTENDANCE_STATUS,REMARKS,CREATED_AT,ATTENDANCE_DATE,...(joined header cols ignored)
 *   rewrite_requests.csv   — columns: REQUEST_ID,ATTENDANCE_DATE,FACILITY,DEPARTMENT,SUPERVISOR_NAME,REASON,REQUEST_STATUS,REQUESTED_AT,ACTIONED_BY,ACTIONED_AT,CREATED_AT
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

function readCSV(filePath: string): Record<string, string>[] {
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath} — skipping`);
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, '').toUpperCase());
  return lines.slice(1).map((line) => {
    const values: string[] = [];
    let inQuote = false;
    let cur = '';
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === ',' && !inQuote) { values.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    values.push(cur.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return row;
  });
}

function parseDate(val: string): Date | null {
  if (!val) return null;
  return new Date(val);
}

async function migrateHeaders() {
  const rows = readCSV(path.join('data', 'attendance_header.csv'));
  if (!rows.length) return;

  console.log(`Migrating ${rows.length} attendance headers...`);
  let done = 0;

  for (const row of rows) {
    const id = parseInt(row.ID);
    if (isNaN(id)) continue;

    const existing = await prisma.attendanceHeader.findUnique({ where: { id } });
    if (existing) { done++; continue; }

    const attendanceDate = parseDate(row.ATTENDANCE_DATE);
    const markedAt = parseDate(row.MARKED_AT) ?? new Date();

    if (!attendanceDate) continue;

    await prisma.attendanceHeader.create({
      data: {
        id,
        attendanceDate,
        facility: row.FACILITY,
        department: row.DEPARTMENT,
        markedBy: row.MARKED_BY,
        markedAt,
        status: row.STATUS || 'submitted',
        shift: row.SHIFT || null,
      },
    }).catch(() => {});
    done++;
  }
  console.log(`Headers migrated: ${done}`);

  // Reset sequence
  const maxId = Math.max(...rows.map((r) => parseInt(r.ID) || 0));
  if (maxId > 0) {
    await prisma.$executeRawUnsafe(`SELECT setval('"attendance_header_id_seq"', ${maxId + 1}, false)`);
  }
}

async function migrateDetails() {
  const rows = readCSV(path.join('data', 'attendance_detail.csv'));
  if (!rows.length) return;

  console.log(`Migrating ${rows.length} attendance details...`);
  let done = 0;

  // The CSV has joined header cols from col 10 onwards — we use only the first 9 detail columns
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    await prisma.$transaction(
      batch
        .filter((row) => row.ID && row.ATTENDANCE_HEADER_ID)
        .map((row) => {
          const id = parseInt(row.ID);
          const headerId = parseInt(row.ATTENDANCE_HEADER_ID);
          const empId = row.EMPLOYEE_ID ? parseInt(row.EMPLOYEE_ID) : null;
          const attendanceDate = parseDate(row.ATTENDANCE_DATE);

          return prisma.attendanceDetail.upsert({
            where: { id },
            update: {},
            create: {
              id,
              headerId,
              employeeId: isNaN(empId!) ? null : empId,
              employeeCode: row.EMPLOYEE_CODE || '',
              employeeName: row.EMPLOYEE_NAME || '',
              attendanceStatus: row.ATTENDANCE_STATUS || 'Present',
              remarks: row.REMARKS || null,
              attendanceDate,
            },
          });
        })
    );
    done += batch.length;
    if (done % 5000 === 0) console.log(`  ...${done} details processed`);
  }
  console.log(`Details migrated: ${done}`);

  const maxId = Math.max(...rows.map((r) => parseInt(r.ID) || 0));
  if (maxId > 0) {
    await prisma.$executeRawUnsafe(`SELECT setval('"attendance_detail_id_seq"', ${maxId + 1}, false)`);
  }
}

async function migrateRewriteRequests() {
  const rows = readCSV(path.join('data', 'rewrite_requests.csv'));
  if (!rows.length) return;

  console.log(`Migrating ${rows.length} rewrite requests...`);
  let done = 0;

  for (const row of rows) {
    const id = parseInt(row.REQUEST_ID);
    if (isNaN(id)) continue;

    const existing = await prisma.attendanceRewriteRequest.findUnique({ where: { id } });
    if (existing) { done++; continue; }

    const attendanceDate = parseDate(row.ATTENDANCE_DATE);
    const requestedAt = parseDate(row.REQUESTED_AT) ?? new Date();
    const actionedAt = parseDate(row.ACTIONED_AT) ?? null;

    if (!attendanceDate) continue;

    await prisma.attendanceRewriteRequest.create({
      data: {
        id,
        attendanceDate,
        facility: row.FACILITY,
        department: row.DEPARTMENT,
        supervisorName: row.SUPERVISOR_NAME,
        reason: row.REASON,
        requestStatus: row.REQUEST_STATUS || 'pending',
        requestedAt,
        actionedBy: row.ACTIONED_BY || null,
        actionedAt,
      },
    }).catch(() => {});
    done++;
  }
  console.log(`Rewrite requests migrated: ${done}`);

  const maxId = Math.max(...rows.map((r) => parseInt(r.REQUEST_ID) || 0));
  if (maxId > 0) {
    await prisma.$executeRawUnsafe(`SELECT setval('"attendance_rewrite_requests_id_seq"', ${maxId + 1}, false)`);
  }
}

async function main() {
  console.log('Starting Snowflake → PostgreSQL migration...');
  await migrateHeaders();
  await migrateDetails();
  await migrateRewriteRequests();
  console.log('Migration complete.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
