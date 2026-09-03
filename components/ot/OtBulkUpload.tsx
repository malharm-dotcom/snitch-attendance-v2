'use client';

import { useRef, useState } from 'react';
import { istDateString } from '@/lib/ist';
import { parseCsv } from '@/lib/csv';
import { useToast } from '../shared/Toast';

interface OtImportRow {
  employee_code: string;
  ot_date: string;
  ot_hours: string;
  reason: string;
}

/**
 * facility and status are NOT importable — the server derives facility from the
 * employee's own row and forces status to 'Pending'.
 */
const HEADERS = ['employee_code', 'ot_date', 'ot_hours', 'reason'];

interface UploadResult {
  inserted: number;
  skipped: number;
  errors: { row: number; error: string }[];
}

function downloadSample() {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const today = istDateString();
  const sample: OtImportRow[] = [
    { employee_code: 'SAPL00001', ot_date: today, ot_hours: '2', reason: 'Peak dispatch, extra picking' },
    { employee_code: 'SAPL00002', ot_date: today, ot_hours: '1.5', reason: 'Inbound backlog' },
  ];
  const csv = [
    HEADERS.join(','),
    ...sample.map((r) => HEADERS.map((h) => escape(String(r[h as keyof OtImportRow]))).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'ot_import_template.csv'; a.click();
  URL.revokeObjectURL(url);
}

const btn: React.CSSProperties = {
  padding: '9px 16px', border: '1.5px solid var(--border)', borderRadius: 'var(--r)',
  fontFamily: 'var(--mono)', fontSize: 13, cursor: 'pointer', background: 'var(--surface)',
};

export default function OtBulkUpload() {
  const [rows, setRows] = useState<OtImportRow[]>([]);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCsv(ev.target?.result as string) as unknown as OtImportRow[];
      setRows(parsed);
      setResult(null);
      if (!parsed.length) showToast('No data rows found in that file', 'error');
    };
    reader.readAsText(file);
  }

  async function upload() {
    if (!rows.length) return;
    setUploading(true);
    try {
      const res = await fetch('/api/ot/bulk-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Import failed (${res.status})`);
      setResult(data);
      showToast(`${data.inserted} OT request(s) created`, data.errors?.length ? 'info' : 'success');
      if (fileRef.current) fileRef.current.value = '';
      setRows([]);
    } catch (err: unknown) {
      showToast((err as Error).message || 'Import failed', 'error');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
      <div>
        <h2 style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 18, margin: 0 }}>Bulk Import OT</h2>
        <p style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-3)', margin: '6px 0 0', lineHeight: 1.6 }}>
          Columns: <strong>employee_code, ot_date, ot_hours, reason</strong>. Facility is taken from
          each employee&apos;s own record and every row is imported as <strong>Pending</strong> —
          neither can be set from the file. Re-uploading the same file will not duplicate rows.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={downloadSample} style={btn}>&darr; Download sample CSV</button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} style={{ fontFamily: 'var(--mono)', fontSize: 12 }} />
      </div>

      {rows.length > 0 && (
        <>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-2)' }}>
            {rows.length} row(s) ready — showing first 10
          </div>
          <div style={{ overflowX: 'auto', border: '1.5px solid var(--border)', borderRadius: 'var(--r)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'var(--mono)' }}>
              <thead>
                <tr style={{ background: 'var(--surface2)' }}>
                  {HEADERS.map((h) => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map((r, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '7px 10px' }}>{r.employee_code}</td>
                    <td style={{ padding: '7px 10px' }}>{r.ot_date}</td>
                    <td style={{ padding: '7px 10px' }}>{r.ot_hours}</td>
                    <td style={{ padding: '7px 10px' }}>{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={upload}
            disabled={uploading}
            style={{ ...btn, background: uploading ? 'var(--surface2)' : 'var(--accent)', color: uploading ? 'var(--text-3)' : 'var(--accent-text)', border: 'none', fontFamily: 'var(--display)', fontWeight: 700, alignSelf: 'flex-start' }}
          >
            {uploading ? 'Importing…' : `Import ${rows.length} row(s)`}
          </button>
        </>
      )}

      {result && (
        <div style={{ border: '1.5px solid var(--border)', borderRadius: 'var(--r)', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>
            <strong style={{ color: 'var(--success)' }}>{result.inserted} created</strong>
            {result.skipped > 0 && <> · <span style={{ color: 'var(--text-2)' }}>{result.skipped} skipped (already pending)</span></>}
            {result.errors.length > 0 && <> · <span style={{ color: 'var(--danger)' }}>{result.errors.length} rejected</span></>}
          </div>
          {result.errors.length > 0 && (
            <div style={{ maxHeight: 220, overflowY: 'auto', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--danger)', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {result.errors.map((e, i) => <div key={i}>Line {e.row}: {e.error}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
