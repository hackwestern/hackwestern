import { DashboardButton } from "~/components/internals/dashboard-button";
import { TableMap } from "~/components/judging/map/table-map";
import {
  MAP_TABLES,
  type MapTable,
  type MapTrack,
  TRACKS,
} from "~/components/judging/map/map-data";

interface TableMapPrintSheetProps {
  tables?: MapTable[];
  tracks?: MapTrack[];
  title?: string;
}

/**
 * The printable copy for the door. Put it on its own page: the Print button
 * (hidden on paper) opens the browser's print dialog, set to landscape.
 * Every table is numbered and carries its track letter, so it still reads
 * on a black and white printer.
 */
export function TableMapPrintSheet({
  tables = MAP_TABLES,
  tracks = TRACKS,
  title = "Hack Western 13 · Table map",
}: TableMapPrintSheetProps) {
  return (
    <div className="flex flex-col gap-4 font-figtree text-dashboard-text-heavy [-webkit-print-color-adjust:exact] [print-color-adjust:exact]">
      <style>
        {"@media print { @page { size: landscape; margin: 12mm; } }"}
      </style>
      <div className="flex items-center justify-between gap-3">
        <h1 className="m-0 text-2xl font-bold">{title}</h1>
        <DashboardButton
          type="button"
          onClick={() => window.print()}
          className="w-auto md:w-auto print:hidden"
        >
          Print map
        </DashboardButton>
      </div>

      <TableMap
        tables={tables}
        tracks={tracks}
        labels
        trackCodes
        showPath
        teams={{}}
        pannable={false}
        fullscreenable={false}
      />

      <section aria-label="Tracks" className="break-inside-avoid">
        <h2 className="m-0 mb-1 text-base font-bold">Tracks</h2>
        <ul className="m-0 grid list-none grid-cols-2 gap-x-6 gap-y-1 p-0 text-base">
          {tracks.map((t) => (
            <li key={t.id}>
              <span className="font-bold">{t.code}</span> · {t.name} · tables{" "}
              {t.from}–{t.to}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
