export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { resolveFacilityScope, ALL_FACILITIES } from '@/lib/facilityScope';
import ManagerClient from './ManagerClient';

export default async function ManagerPage() {
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== 'manager') {
    redirect('/');
  }

  // Facility shown to the client is the RESOLVED scope, never the raw home facility —
  // so an all-access user's selection is reflected everywhere on the next render.
  const scope = resolveFacilityScope(session);

  return (
    <ManagerClient
      supervisorName={session.supervisorName}
      facility={scope.active ?? ALL_FACILITIES}
      allFacilities={session.allFacilities === true}
      department={session.department}
      departments={session.departments}
      role={session.role}
    />
  );
}
