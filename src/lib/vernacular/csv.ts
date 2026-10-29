// Ad variants from a spreadsheet export, for the campaign check.

/** A small CSV reader: quoted fields, and commas and newlines inside quotes. */
export function parseCsv(src: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim()));
}

/** Variants from a CSV: a "copy"/"text" column (or the last column), and an optional "name" column. */
export function variantsFromCsv(src: string, max = 5): { name: string; text: string }[] {
  const rows = parseCsv(src);
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const textCol = head.findIndex((h) => ["copy", "text", "variant", "ad", "body"].includes(h));
  const nameCol = head.findIndex((h) => ["name", "label", "variant name", "title"].includes(h));
  const hasHeader = textCol >= 0 || nameCol >= 0;
  const t = textCol >= 0 ? textCol : rows[0].length - 1;
  return (hasHeader ? rows.slice(1) : rows)
    .map((r, i) => ({ name: (nameCol >= 0 ? r[nameCol] : "")?.trim() || `Variant ${String.fromCharCode(65 + i)}`, text: (r[t] ?? "").trim() }))
    .filter((v) => v.text)
    .slice(0, max);
}

