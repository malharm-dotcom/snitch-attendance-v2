/** Returns current time in IST as a JS Date. Use on server — never raw new Date(). */
export function istNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
}

/** Returns today's date in IST as YYYY-MM-DD string. */
export function istDateString(date?: Date): string {
  const d = date ?? istNow();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Returns IST timestamp string: "DD Mon YYYY HH:MM IST" */
export function istTimestamp(date?: Date): string {
  const d = date ?? istNow();
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }) + ' IST';
}

/** Parses a YYYY-MM-DD string into a Date at midnight IST. */
export function parseISTDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(new Date(`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}T00:00:00+05:30`));
}
