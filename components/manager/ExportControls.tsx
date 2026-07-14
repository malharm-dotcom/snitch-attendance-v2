'use client';

import { useState } from 'react';
import { exportElementToPng, type ImageHeaderMeta } from '@/lib/exportImage';

interface Props {
  onDownloadCSV: () => void;
  captureRef: React.RefObject<HTMLElement | null>;
  pngFilename: string;
  meta: ImageHeaderMeta;
  /** Optional hook to prepare the DOM before capture (e.g. reveal hidden columns). */
  onBeforeCapture?: () => void | Promise<void>;
  onAfterCapture?: () => void;
}

const btn: React.CSSProperties = {
  padding: '7px 14px',
  border: '1.5px solid var(--border)',
  borderRadius: 8,
  fontFamily: 'var(--mono)',
  fontSize: 12,
  cursor: 'pointer',
  background: 'var(--surface)',
  whiteSpace: 'nowrap',
};

/** Wait for two animation frames so DOM/layout changes from onBeforeCapture have painted. */
function nextPaint(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

/** Consistent CSV + PNG export controls, grouped top-right of every report. */
export default function ExportControls({
  onDownloadCSV,
  captureRef,
  pngFilename,
  meta,
  onBeforeCapture,
  onAfterCapture,
}: Props) {
  const [busy, setBusy] = useState(false);

  async function handlePng() {
    if (busy) return;
    setBusy(true);
    try {
      if (onBeforeCapture) {
        await onBeforeCapture();
        await nextPaint();
      }
      if (captureRef.current) {
        await exportElementToPng(captureRef.current, pngFilename, meta);
      }
    } catch (e) {
      console.error('[png-export]', e);
    } finally {
      onAfterCapture?.();
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
      <button onClick={onDownloadCSV} style={btn}>&darr; Download CSV</button>
      <button
        onClick={handlePng}
        disabled={busy}
        style={{ ...btn, opacity: busy ? 0.6 : 1, cursor: busy ? 'wait' : 'pointer' }}
        title="Download as image (PNG)"
      >
        &darr; {busy ? 'Rendering…' : 'PNG'}
      </button>
    </div>
  );
}
