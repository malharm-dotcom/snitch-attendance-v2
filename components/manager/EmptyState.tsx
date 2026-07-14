'use client';

/** Single-line plain empty state shared across all five reports. */
export default function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-3)', fontFamily: 'var(--mono)', fontSize: 13 }}>
      No data for this range.
    </div>
  );
}
