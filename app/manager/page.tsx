export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import ManagerClient from './ManagerClient';

export default async function ManagerPage() {
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== 'manager') {
    redirect('/');
  }

  return (
    <ManagerClient
      supervisorName={session.supervisorName}
      facility={session.facility}
      department={session.department}
      departments={session.departments}
      role={session.role}
    />
  );
}
