'use client';

import HiringSubmitForm from './HiringSubmitForm';

/**
 * The Hiring workspace, rendered by the supervisor, manager and admin shells.
 * Step 2 is submission only — the approval queue and summary tab slot in here,
 * so the three shells never need touching again.
 */
export default function HiringPanel() {
  return <HiringSubmitForm />;
}
