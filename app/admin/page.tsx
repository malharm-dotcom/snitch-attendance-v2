export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { resolveFacilityScope, ALL_FACILITIES } from '@/lib/facilityScope';
import AdminClient from './AdminClient';

export default async function AdminPage() {
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== 'admin') {
    redirect('/');
  }

  // Facility shown to the client is the RESOLVED scope, never the raw home facility —
  // so an all-access user's selection is reflected everywhere on the next render.
  const scope = resolveFacilityScope(session);

  return (
    <AdminClient
      supervisorName={session.supervisorName}
      facility={scope.active ?? ALL_FACILITIES}
      allFacilities={session.allFacilities === true}
      department={session.department}
      departments={session.departments}
      role={session.role}
    />
  );
}
