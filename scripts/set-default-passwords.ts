/**
 * One-time migration: set employee_code + password_hash for all supervisors.
 *
 * Logic:
 *   - If employee_code is already set → password_hash = bcrypt(employee_code)
 *   - If employee_code is NULL         → employee_code = pin, password_hash = bcrypt(pin)
 *   - Rows that already have password_hash are skipped.
 *
 * Run: npx ts-node -e "require('./scripts/set-default-passwords.ts')"
 * Or:  npx tsx scripts/set-default-passwords.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Setting default passwords for supervisors...\n');

  const supervisors = await prisma.supervisor.findMany();
  let updated = 0;
  let skipped = 0;

  for (const sup of supervisors) {
    if (sup.passwordHash) {
      console.log(`  SKIP  ${sup.supervisorName} — password already set`);
      skipped++;
      continue;
    }

    // Use existing employee_code if set; otherwise assign the PIN as employee_code
    const credential = sup.employeeCode ?? sup.pin;
    const passwordHash = await bcrypt.hash(credential, 10);

    await prisma.supervisor.update({
      where: { id: sup.id },
      data: {
        passwordHash,
        ...(sup.employeeCode ? {} : { employeeCode: sup.pin }),
      },
    });

    updated++;
    console.log(`  SET   ${sup.supervisorName} — employee_code: ${credential}`);
  }

  console.log(`\nDone. ${updated} updated, ${skipped} skipped.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
