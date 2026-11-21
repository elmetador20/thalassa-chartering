// Minimal RFC 4180 CSV reading and writing — enough for the report import
// template, without a dependency. Used in the browser (preview) and in tests.
//
// Reading: quoted fields, "" escapes, commas and line breaks inside quotes,
// CRLF / LF / CR line endings, a leading UTF-8 BOM (Excel adds one), and
// blank lines (skipped).
//
// Writing: every cell is quoted, and cells that a spreadsheet would treat as
// a formula (= + - @, tab, CR) are prefixed with ' — the error report is
// meant to be opened in Excel, and imported titles are untrusted input.

export interface CsvParseResult {
  rows: string[][];
  error: string | null;
}

export function parseCsv(input: string): CsvParseResult {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    if (!(row.length === 1 && row[0].trim() === '')) rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"' && field.trim() === '') {
      field = '';
      quoted = true;
    } else if (c === ',') {
      endField();
    } else if (c === '\r' || c === '\n') {
      endRow();
      if (c === '\r' && text[i + 1] === '\n') i++;
    } else {
      field += c;
    }
    i++;
  }
  if (quoted) return { rows, error: 'The CSV has a quoted value that is never closed.' };
  if (field !== '' || row.length > 0) endRow();
  return { rows, error: null };
}

const FORMULA_START = /^[=+\-@\t\r]/;

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          let value = cell === null || cell === undefined ? '' : String(cell);
          if (FORMULA_START.test(value)) value = `'${value}`;
          return `"${value.replace(/"/g, '""')}"`;
        })
        .join(','),
    )
    .join('\r\n');
}
