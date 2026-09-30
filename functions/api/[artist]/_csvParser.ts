// Quote-aware CSV tokenizer — splits raw CSV text into rows of raw cell values,
// respecting quoted fields that contain commas, quotes, or embedded newlines.
export function splitCSVRows(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        current.push(field);
        field = '';
      } else if (ch === '\n') {
        current.push(field);
        field = '';
        rows.push(current);
        current = [];
      } else if (ch !== '\r') {
        field += ch;
      }
    }
  }

  if (field || current.length > 0) {
    current.push(field);
    rows.push(current);
  }

  return rows;
}

// Re-serialize rows of raw cell values back into CSV text, quoting only cells
// that need it (contain a comma, quote, or newline).
export function joinCSVRows(rows: string[][]): string {
  return rows
    .map(row => row.map(cell => (
      /[",\n\r]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell
    )).join(','))
    .join('\n');
}

export function parseCSV(text: string): Record<string, string>[] {
  const rows = splitCSVRows(text);

  if (rows.length < 2) return [];

  const headers = rows[0];
  return rows.slice(1)
    .filter(row => row.some(cell => cell.trim() !== ''))
    .map(row => {
      const obj: Record<string, string> = {};
      headers.forEach((header, i) => {
        obj[header] = row[i] ?? '';
      });
      return obj;
    });
}

export function csvResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
