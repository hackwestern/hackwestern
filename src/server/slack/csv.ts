/** CSV text to rows; quoted fields may hold commas, quotes and newlines. */
export function readCsv(csv: string): string[][] {
  const rows: string[][] = [];
  const input = csv.replace(/^﻿/, "");
  const field = /(?:"((?:[^"]|"")*)"|([^",\r\n]*))(,|\r\n|\n|\r|$)/y;
  let row: string[] = [];
  let offset = 0;
  while (offset < input.length) {
    field.lastIndex = offset;
    const match = field.exec(input);
    if (!match) throw new Error(`Malformed CSV on record ${rows.length + 1}`);
    offset = field.lastIndex;
    row.push(match[1]?.replaceAll('""', '"') ?? match[2] ?? "");
    if (match[3] === "," && offset === input.length) row.push("");
    else if (match[3] === ",") continue;
    if (row.length > 1 || row[0]?.trim()) rows.push(row);
    row = [];
  }
  return rows;
}
