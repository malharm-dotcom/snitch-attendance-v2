/**
 * Quote-aware CSV parsing.
 *
 * The employee bulk-upload does `line.split(',')`, which is fine for its columns but
 * cannot be reused for OT: `reason` is free text and routinely contains commas, so a
 * naive split shifts every later column and silently corrupts the row.
 */

/** Split one CSV line, honouring "quoted, fields" and "" escapes. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }  // escaped ""
        else inQuotes = false;
      } else cur += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      out.push(cur); cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

/**
 * Parse a CSV document into row objects keyed by lower-cased header.
 * Blank lines are dropped; a file with no data rows yields [].
 */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').trim().split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return row;
  });
}
