import { toPng } from 'html-to-image';

/** Compact header band prepended to every exported PNG so a pasted image is self-describing. */
export interface ImageHeaderMeta {
  title: string;
  scope: string;
  range: string;
}

const PIXEL_RATIO = 2;
const HEADER_H = 64; // CSS px, before pixelRatio scaling

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Captures a report table container as a PNG with a white background and a
 * compact title/scope/range header band. Captures the FULL scroll width so
 * horizontally-scrolled tables are exported in full, not just the viewport.
 */
export async function exportElementToPng(
  node: HTMLElement,
  filename: string,
  meta: ImageHeaderMeta,
): Promise<void> {
  // Full content size — tables may scroll horizontally and vertically.
  const width = Math.max(node.scrollWidth, node.offsetWidth);
  const height = Math.max(node.scrollHeight, node.offsetHeight);

  const tableDataUrl = await toPng(node, {
    pixelRatio: PIXEL_RATIO,
    backgroundColor: '#ffffff',
    width,
    height,
    // Override the scroll container's clipping so the whole table renders.
    style: {
      overflow: 'visible',
      maxHeight: 'none',
      width: `${width}px`,
      height: `${height}px`,
    },
  });

  const tableImg = await loadImage(tableDataUrl);

  const headerPx = HEADER_H * PIXEL_RATIO;
  const canvas = document.createElement('canvas');
  canvas.width = tableImg.width;
  canvas.height = tableImg.height + headerPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // Explicit white background (tables may be transparent).
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const pad = 20 * PIXEL_RATIO;

  // Title
  ctx.fillStyle = '#111111';
  ctx.font = `700 ${18 * PIXEL_RATIO}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(meta.title, pad, 27 * PIXEL_RATIO);

  // Scope · range
  ctx.fillStyle = '#555555';
  ctx.font = `400 ${12 * PIXEL_RATIO}px ui-monospace, Menlo, Consolas, monospace`;
  ctx.fillText(`${meta.scope}   ·   ${meta.range}`, pad, 47 * PIXEL_RATIO);

  // Divider between header band and table
  ctx.strokeStyle = '#e2e2e2';
  ctx.lineWidth = PIXEL_RATIO;
  ctx.beginPath();
  ctx.moveTo(0, headerPx - PIXEL_RATIO / 2);
  ctx.lineTo(canvas.width, headerPx - PIXEL_RATIO / 2);
  ctx.stroke();

  ctx.drawImage(tableImg, 0, headerPx);

  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = filename;
  a.click();
}
