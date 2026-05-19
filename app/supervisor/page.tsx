export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import SupervisorClient from './SupervisorClient';

export default async function SupervisorPage() {
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== 'supervisor') {
    redirect('/');
  }

  return (
    <SupervisorClient
      supervisorName={session.supervisorName}
      facility={session.facility}
      department={session.department}
      departments={session.departments}
      role={session.role}
    />
  );
}
