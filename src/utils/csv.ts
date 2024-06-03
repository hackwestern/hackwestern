function columnNames(
  object: Record<string, unknown>,
  separator: string,
): string {
  return Object.keys(object).join(separator) + "\n";
}

export function createCsvFile(
  objects: Record<string, unknown>[],
  separator: string = ";",
): string {
  const firstRow = columnNames(objects[0] ?? {}, separator);

  const fileString = objects.reduce((acc, ob) => {
    acc += Object.values(ob).join(separator).replaceAll("\n", " ") + "\n";
    return acc;
  }, firstRow);

  return fileString;
}
