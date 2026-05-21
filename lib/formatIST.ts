export function formatIST(date: Date | string): string {
  const d = new Date(date);
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'UTC',
  }) + ' IST';
}
