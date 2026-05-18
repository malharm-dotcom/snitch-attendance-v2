import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

function readCSV(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return row;
  });
}

function parseBool(val: string): boolean {
  return val?.toLowerCase() === 'true' || val === '1';
}

async function seedSupervisors() {
  const filePath = path.join(__dirname, '../data/supervisors.csv');
  if (!fs.existsSync(filePath)) {
    console.log('No supervisors.csv found — skipping');
    return;
  }

  const rows = readCSV(filePath);
  console.log(`Seeding ${rows.length} supervisors...`);

  for (const row of rows) {
    const depts = row.departments
      ? row.departments.split(',').map((d) => d.trim()).filter(Boolean)
      : row.department
        ? [row.department]
        : [];

    await prisma.supervisor.upsert({
      where: { id: 0 },
      create: {
        supervisorName: row.supervisor_name,
        facility: row.facility,
        department: row.department || (depts[0] ?? ''),
        departments: depts,
        pin: row.pin,
        role: row.role || 'supervisor',
        isActive: parseBool(row.is_active ?? 'true'),
      },
      update: {},
    }).catch(async () => {
      const existing = await prisma.supervisor.findFirst({
        where: { supervisorName: row.supervisor_name, facility: row.facility },
      });
      if (!existing) {
        await prisma.supervisor.create({
          data: {
            supervisorName: row.supervisor_name,
            facility: row.facility,
            department: row.department || (depts[0] ?? ''),
            departments: depts,
            pin: row.pin,
            role: row.role || 'supervisor',
            isActive: parseBool(row.is_active ?? 'true'),
          },
        });
      }
    });
  }
  console.log('Supervisors seeded.');
}

async function seedEmployees() {
  const filePath = path.join(__dirname, '../data/employee_master.csv');
  if (!fs.existsSync(filePath)) {
    console.log('No employee_master.csv found — skipping');
    return;
  }

  const rows = readCSV(filePath);
  console.log(`Seeding ${rows.length} employees...`);

  let inserted = 0;
  let updated = 0;

  for (const row of rows) {
    if (!row.employee_code) continue;

    const data = {
      employeeName: row.employee_name,
      facility: row.facility,
      department: row.department,
      isActive: parseBool(row.is_active ?? 'true'),
      shift: row.shift || null,
      designation: row.designation || null,
      reportingManager: row.reporting_manager || null,
      rollType: row.roll_type || null,
      gender: row.gender || null,
    };

    const existing = await prisma.employee.findUnique({ where: { employeeCode: row.employee_code } });
    if (existing) {
      await prisma.employee.update({ where: { employeeCode: row.employee_code }, data });
      updated++;
    } else {
      await prisma.employee.create({ data: { employeeCode: row.employee_code, ...data } });
      inserted++;
    }
  }

  console.log(`Employees seeded: ${inserted} inserted, ${updated} updated.`);
}

async function main() {
  console.log('Starting seed...');
  await seedSupervisors();
  await seedEmployees();
  console.log('Seed complete.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
