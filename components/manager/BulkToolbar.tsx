'use client';

interface BulkToolbarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBulkApprove: () => void;
  onBulkReject: () => void;
}

export default function BulkToolbar({ selectedCount, totalCount, onSelectAll, onDeselectAll, onBulkApprove, onBulkReject }: BulkToolbarProps) {
  if (totalCount === 0) return null;

  return (
    <div style={{
      background: selectedCount > 0 ? 'var(--accent)' : 'var(--surface2)',
      borderRadius: 'var(--r)',
      padding: '10px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap',
      transition: 'background 0.2s',
    }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: selectedCount > 0 ? 'var(--accent-text)' : 'var(--text-2)', fontWeight: 500 }}>
        {selectedCount > 0 ? `${selectedCount} selected` : 'Select requests'}
      </span>

      {selectedCount < totalCount ? (
        <button onClick={onSelectAll} style={{ padding: '5px 12px', border: '1.5px solid currentColor', borderRadius: 8, background: 'none', fontFamily: 'var(--mono)', fontSize: 12, cursor: 'pointer', color: selectedCount > 0 ? 'var(--accent-text)' : 'var(--text-2)' }}>
          Select all ({totalCount})
        </button>
      ) : (
        <button onClick={onDeselectAll} style={{ padding: '5px 12px', border: '1.5px solid currentColor', borderRadius: 8, background: 'none', fontFamily: 'var(--mono)', fontSize: 12, cursor: 'pointer', color: 'var(--accent-text)' }}>
          Deselect all
        </button>
      )}

      {selectedCount > 0 && (
        <>
          <button
            onClick={onBulkApprove}
            style={{ padding: '6px 16px', border: 'none', borderRadius: 8, background: 'var(--success)', color: '#fff', fontFamily: 'var(--display)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            Approve {selectedCount}
          </button>
          <button
            onClick={onBulkReject}
            style={{ padding: '6px 16px', border: '2px solid var(--danger)', borderRadius: 8, background: '#fff', color: 'var(--danger)', fontFamily: 'var(--display)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            Reject {selectedCount}
          </button>
        </>
      )}
    </div>
  );
}
