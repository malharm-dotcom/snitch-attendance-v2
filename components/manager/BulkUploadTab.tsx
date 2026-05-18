'use client';

import { useState, useRef } from 'react';
import { useToast } from '../shared/Toast';

interface EmployeeRow {
  employee_code: string;
  employee_name: string;
  facility: string;
  department: string;
  is_active: string;
  shift: string;
  designation: string;
  reporting_manager: string;
  roll_type: string;
  gender: string;
}

const TEMPLATE_HEADERS = [
  'employee_code', 'employee_name', 'facility', 'department',
  'is_active', 'shift', 'designation', 'reporting_manager', 'roll_type', 'gender',
];

function parseCSV(text: string): EmployeeRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return row as unknown as EmployeeRow;
  });
}

function downloadTemplate() {
  const csv = TEMPLATE_HEADERS.join(',') + '\n';
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'employee_template.csv'; a.click();
  URL.revokeObjectURL(url);
}

export default function BulkUploadTab() {
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [result, setResult] = useState<{ inserted: number; updated: number; errors: { row: number; error: string }[] } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCSV(ev.target?.result as string);
      setRows(parsed);
      setResult(null);
    };
    reader.readAsText(file);
  }

  async function handleUpload() {
    if (!rows.length) return;
    setUploading(true);
    try {
      const res = await fetch('/api/employees/bulk-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      setResult(data);
      showToast(`Done: ${data.inserted} inserted, ${data.updated} updated`, 'success');
      setRows([]);
      if (fileRef.current) fileRef.current.value = '';
    } catch {
      showToast('Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 18, margin: 0 }}>Bulk Employee Upload</h2>
        <button
          onClick={downloadTemplate}
          style={{ marginLeft: 'auto', padding: '7px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 12, cursor: 'pointer', background: 'var(--surface)' }}
        >
          ↓ Download Template
        </button>
      </div>

      <div style={{ border: '2px dashed var(--border)', borderRadius: 'var(--r)', padding: '32px 24px', textAlign: 'center' }}>
        <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} id="csv-upload" />
        <label htmlFor="csv-upload" style={{ cursor: 'pointer', display: 'block' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
          <div style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
            {rows.length > 0 ? `${rows.length} rows loaded` : 'Click to select CSV file'}
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-3)' }}>
            Required columns: employee_code, employee_name, facility, department, is_active
          </div>
        </label>
      </div>

      {rows.length > 0 && (
        <>
          <div style={{ overflowX: 'auto', maxHeight: 320 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'var(--mono)' }}>
              <thead style={{ position: 'sticky', top: 0 }}>
                <tr style={{ background: 'var(--surface2)', borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-2)', fontSize: 10, textTransform: 'uppercase' }}>#</th>
                  {TEMPLATE_HEADERS.map((h) => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-2)', fontSize: 10, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface2)' }}>
                    <td style={{ padding: '7px 10px', color: 'var(--text-3)' }}>{i + 1}</td>
                    {TEMPLATE_HEADERS.map((h) => (
                      <td key={h} style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>{(row as unknown as Record<string, string>)[h] || '—'}</td>
                    ))}
                  </tr>
                ))}
                {rows.length > 50 && (
                  <tr><td colSpan={TEMPLATE_HEADERS.length + 1} style={{ padding: '8px 10px', color: 'var(--text-3)', textAlign: 'center' }}>...and {rows.length - 50} more rows</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleUpload}
            disabled={uploading}
            style={{ padding: '12px', background: uploading ? 'var(--surface2)' : 'var(--accent)', color: uploading ? 'var(--text-3)' : 'var(--accent-text)', border: 'none', borderRadius: 'var(--r)', fontFamily: 'var(--display)', fontWeight: 700, fontSize: 15, cursor: uploading ? 'not-allowed' : 'pointer' }}
          >
            {uploading ? 'Uploading...' : `Confirm Upload (${rows.length} rows)`}
          </button>
        </>
      )}

      {result && (
        <div style={{ background: 'var(--surface2)', borderRadius: 'var(--r)', padding: '16px 20px' }}>
          <div style={{ fontFamily: 'var(--display)', fontWeight: 700, marginBottom: 8 }}>Upload Result</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 13, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--success)' }}>✓ {result.inserted} inserted</span>
            <span style={{ color: 'var(--warn)' }}>↻ {result.updated} updated</span>
            {result.errors.length > 0 && <span style={{ color: 'var(--danger)' }}>✗ {result.errors.length} errors</span>}
          </div>
          {result.errors.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {result.errors.map((e) => (
                <div key={e.row} style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--danger)', padding: '4px 0' }}>
                  Row {e.row}: {e.error}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
