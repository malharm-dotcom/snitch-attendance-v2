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

const REQUIRED_HEADERS = [
  'employee_code', 'employee_name', 'facility', 'department',
  'is_active', 'shift', 'designation', 'reporting_manager', 'roll_type', 'gender',
];

const EXAMPLE_ROW: EmployeeRow = {
  employee_code: 'SAPL00001',
  employee_name: 'John Doe',
  facility: 'WH1',           // WH1 | WH2 | NORTH
  department: 'B2C Forward', // B2C Forward | B2C Return | B2B Forward | B2B Return | Inventory | Inward | Ops | Logistics | Admin
  is_active: 'TRUE',          // TRUE | FALSE
  shift: 'Day',               // Day | Night
  designation: 'Executive',
  reporting_manager: 'Manager Name',
  roll_type: 'On-Roll',             // On-Roll | Off-Roll
  gender: 'Male',             // Male | Female | Other
};

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

function toCSV(headers: string[], rows: Record<string, unknown>[]): string {
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
}

function downloadBlob(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function downloadTemplate() {
  const csv = toCSV(REQUIRED_HEADERS, [EXAMPLE_ROW as unknown as Record<string, unknown>]);
  downloadBlob(csv, 'employee_template.csv');
}

export default function BulkUploadTab() {
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [result, setResult] = useState<{ inserted: number; updated: number; errors: { row: number; error: string }[] } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
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

  async function downloadCurrentData() {
    setDownloading(true);
    try {
      const res = await fetch('/api/reports/employees');
      if (!res.ok) throw new Error();
      const json = await res.json();
      const employees: Record<string, unknown>[] = json.employees ?? [];
      if (!employees.length) { showToast('No employee data found', 'info'); return; }
      const headers = REQUIRED_HEADERS;
      const mapped = employees.map((e) => ({
        employee_code: e.employee_code ?? e.employeeCode ?? '',
        employee_name: e.employee_name ?? e.employeeName ?? '',
        facility: e.facility ?? '',
        department: e.department ?? '',
        is_active: e.is_active ?? e.isActive ?? '',
        shift: e.shift ?? '',
        designation: e.designation ?? '',
        reporting_manager: e.reporting_manager ?? e.reportingManager ?? '',
        roll_type: e.roll_type ?? e.rollType ?? '',
        gender: e.gender ?? '',
      }));
      const scope: string = json.scope ?? 'all';
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(toCSV(headers, mapped), `employees_${scope}_${date}.csv`);
      showToast(`Downloaded ${mapped.length} employees`, 'success');
    } catch {
      showToast('Failed to download employee data', 'error');
    } finally {
      setDownloading(false);
    }
  }

  const btnBase: React.CSSProperties = {
    padding: '8px 16px',
    border: '1.5px solid var(--border)',
    borderRadius: 8,
    fontFamily: 'var(--mono)',
    fontSize: 12,
    cursor: 'pointer',
    background: 'var(--surface)',
    color: 'var(--text)',
    transition: 'background 0.15s, border-color 0.15s',
    fontWeight: 500,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 18, margin: 0 }}>
          Employee Master
        </h2>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={downloadTemplate} style={btnBase}>
            ↓ Template
          </button>
          <button
            onClick={downloadCurrentData}
            disabled={downloading}
            style={{ ...btnBase, borderColor: downloading ? 'var(--border)' : 'var(--accent)', color: downloading ? 'var(--text-3)' : 'var(--text)' }}
          >
            {downloading ? 'Downloading...' : '↓ Current Data'}
          </button>
        </div>
      </div>

      {/* Template info */}
      <div style={{ background: 'var(--surface2)', borderRadius: 'var(--r)', padding: '12px 16px', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7 }}>
        <strong style={{ color: 'var(--text)', display: 'block', marginBottom: 4 }}>All fields are required in the CSV template.</strong>
        facility: <code>WH1 | WH2 | NORTH</code> &nbsp;·&nbsp;
        department: <code>B2C Forward | B2C Return | B2B Forward | B2B Return | Inventory | Inward | Ops | Logistics | Admin</code> &nbsp;·&nbsp;
        is_active: <code>TRUE | FALSE</code> &nbsp;·&nbsp;
        shift: <code>Day | Night</code> &nbsp;·&nbsp;
        roll_type: <code>On-Roll | Off-Roll</code> &nbsp;·&nbsp;
        gender: <code>Male | Female | Other</code>
      </div>

      {/* Drop zone */}
      <div style={{
        border: rows.length > 0 ? '2px solid var(--accent)' : '2px dashed var(--border)',
        borderRadius: 'var(--r)',
        padding: '32px 24px',
        textAlign: 'center',
        transition: 'border-color 0.2s',
        background: rows.length > 0 ? 'rgba(200,223,32,0.05)' : 'transparent',
      }}>
        <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} id="csv-upload" />
        <label htmlFor="csv-upload" style={{ cursor: 'pointer', display: 'block' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
          <div style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
            {rows.length > 0 ? `${rows.length} rows ready to upload` : 'Click to select CSV file'}
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-3)' }}>
            {rows.length > 0 ? 'Click to choose a different file' : 'Use the template above for the correct format'}
          </div>
        </label>
      </div>

      {rows.length > 0 && (
        <>
          <div style={{ overflowX: 'auto', maxHeight: 320, borderRadius: 'var(--r)', border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'var(--mono)' }}>
              <thead style={{ position: 'sticky', top: 0 }}>
                <tr style={{ background: 'var(--surface2)', borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-3)', fontSize: 10, textTransform: 'uppercase' }}>#</th>
                  {REQUIRED_HEADERS.map((h) => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-2)', fontSize: 10, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface2)' }}>
                    <td style={{ padding: '7px 10px', color: 'var(--text-3)' }}>{i + 1}</td>
                    {REQUIRED_HEADERS.map((h) => (
                      <td key={h} style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>{(row as unknown as Record<string, string>)[h] || '—'}</td>
                    ))}
                  </tr>
                ))}
                {rows.length > 50 && (
                  <tr>
                    <td colSpan={REQUIRED_HEADERS.length + 1} style={{ padding: '8px 10px', color: 'var(--text-3)', textAlign: 'center' }}>
                      ...and {rows.length - 50} more rows
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleUpload}
            disabled={uploading}
            style={{
              padding: '13px',
              background: uploading ? 'var(--surface2)' : 'var(--accent)',
              color: uploading ? 'var(--text-3)' : 'var(--accent-text)',
              border: 'none',
              borderRadius: 'var(--r)',
              fontFamily: 'var(--display)',
              fontWeight: 700,
              fontSize: 15,
              cursor: uploading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {uploading ? 'Uploading...' : `Confirm Upload (${rows.length} rows)`}
          </button>
        </>
      )}

      {result && (
        <div style={{ background: 'var(--surface2)', borderRadius: 'var(--r)', padding: '16px 20px' }}>
          <div style={{ fontFamily: 'var(--display)', fontWeight: 700, marginBottom: 10 }}>Upload Result</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 13, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--success)' }}>✓ {result.inserted} inserted</span>
            <span style={{ color: 'var(--warn)' }}>↻ {result.updated} updated</span>
            {result.errors.length > 0 && <span style={{ color: 'var(--danger)' }}>✗ {result.errors.length} errors</span>}
          </div>
          {result.errors.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {result.errors.map((e) => (
                <div key={e.row} style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--danger)', padding: '3px 0' }}>
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
