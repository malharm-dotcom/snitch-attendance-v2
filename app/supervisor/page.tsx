export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { resolveFacilityScope, ALL_FACILITIES } from '@/lib/facilityScope';
import SupervisorClient from './SupervisorClient';

export default async function SupervisorPage() {
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== 'supervisor') {
    redirect('/');
  }

  // Facility shown to the client is the RESOLVED scope, never the raw home facility —
  // so an all-access user's selection is reflected everywhere on the next render.
  const scope = resolveFacilityScope(session);

  return (
    <SupervisorClient
      supervisorName={session.supervisorName}
      facility={scope.active ?? ALL_FACILITIES}
      allFacilities={session.allFacilities === true}
      department={session.department}
      departments={session.departments}
      role={session.role}
    />
  );
}
