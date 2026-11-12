import { db } from "~/server/db";

export interface JudgeTableRow {
  number: number;
  zone: string;
}

export interface JudgeInitialData {
  /** Every active table, for the map. */
  tables: JudgeTableRow[];
  /** Team id -> table number, for every team seated at a table. */
  tableByTeam: Record<string, number>;
}

/**
 * Read-only data for the judge page, loaded straight from the db in
 * getServerSideProps (no extra tRPC procedures). The judging router does all
 * the reading and writing of marks; this only supplies what it can't:
 * which table each team is at. A snapshot from page load.
 */
export async function loadJudgeData(): Promise<JudgeInitialData> {
  const [tables, seated] = await Promise.all([
    db.query.judgingTables.findMany({
      where: (t, { eq }) => eq(t.isActive, true),
      columns: { number: true, zone: true },
      orderBy: (t, { asc }) => [asc(t.number)],
    }),
    db.query.teams.findMany({
      where: (t, { isNotNull }) => isNotNull(t.judgingTableId),
      columns: { id: true },
      with: { judgingTable: { columns: { number: true } } },
    }),
  ]);

  const tableByTeam: Record<string, number> = {};
  for (const t of seated) {
    if (t.judgingTable) tableByTeam[t.id] = t.judgingTable.number;
  }
  return { tables, tableByTeam };
}
