export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import AdminClient from './AdminClient';

export default async function AdminPage() {
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== 'admin') {
    redirect('/');
  }

  return (
    <AdminClient
      supervisorName={session.supervisorName}
      facility={session.facility}
      department={session.department}
      departments={session.departments}
      role={session.role}
    />
  );
}
