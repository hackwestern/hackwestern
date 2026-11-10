import { useState } from "react";

import { DashboardChip } from "~/components/internals/dashboard-chip";
import { field } from "~/components/judging/shared/judge-ui";
import {
  JUDGES_PER_TABLE,
  MAP_TABLES,
  type MapTable,
  type MapTrack,
  PLACEHOLDER_TEAMS,
  TABLE_H,
  TABLE_W,
  TRACKS,
  mapBounds,
  trackOf,
} from "~/components/judging/map/map-data";

/** Width of the "Near me" view, in map units. About five tables across. */
const ZOOM_WIDTH = 210;

const clamp = (n: number, min: number, max: number) =>
  Math.min(Math.max(n, min), max);

export interface TableMapProps {
  tables?: MapTable[];
  tracks?: MapTrack[];
  /** Team name by table number. */
  teams?: Record<number, string>;
  /** The one table to point at: a hacker's own table, or a judge's next table. */
  focus?: number;
  focusLabel?: string;
  /** Other tables to mark, e.g. a judge's remaining tables. */
  mine?: number[];
  mineLabel?: string;
  /** A sponsor's track: only its block is coloured; the rest stay plain. */
  highlightTrack?: string;
  /** Colour tables by track and list the tracks. Off for hackers and judges. */
  showTrackColors?: boolean;
  /** Organizer view: judges who have scored each table. Draws "n of 3". */
  judgesScored?: Record<number, number>;
  /** Draw the snake path through the tables in order. */
  showPath?: boolean;
  /** Draw table numbers (always on when zoomed in). */
  labels?: boolean;
  /** Print each table's track letter, so a black and white copy still reads. */
  trackCodes?: boolean;
  showTrackLegend?: boolean;
  /** Search box for a team name or table number. */
  searchable?: boolean;
  /** "Near me" zoom. Needs a focus table or a single search result. */
  zoomable?: boolean;
  /** Map / List switch. The list is also the fallback without the drawing. */
  listToggle?: boolean;
}

/** The room map: every table numbered, track blocks in colour, the snake path. */
export function TableMap({
  tables = MAP_TABLES,
  tracks = TRACKS,
  teams = PLACEHOLDER_TEAMS,
  focus,
  focusLabel = "Your table",
  mine = [],
  mineLabel = "Your other tables",
  highlightTrack,
  showTrackColors = true,
  judgesScored,
  showPath = true,
  labels = false,
  trackCodes = false,
  showTrackLegend = true,
  searchable = false,
  zoomable = false,
  listToggle = false,
}: TableMapProps) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"map" | "list">("map");
  const [zoomed, setZoomed] = useState(false);

  const q = query.trim().toLowerCase();
  const matches =
    q === ""
      ? []
      : tables.filter(
          (t) =>
            String(t.n) === q || (teams[t.n] ?? "").toLowerCase().includes(q),
        );
  const matched = new Set(matches.map((t) => t.n));
  // Which tracks get a colour: just the sponsor's own, all of them, or none.
  const coloured = highlightTrack
    ? tracks.filter((t) => t.id === highlightTrack)
    : showTrackColors
      ? tracks
      : [];
  const searching = q !== "";
  const mineSet = new Set(mine);

  const focusTable = tables.find((t) => t.n === focus);
  const target = matches.length === 1 ? matches[0] : focusTable;
  const { width, height } = mapBounds(tables);

  let box = { x: 0, y: 0, w: width, h: height };
  if (zoomed && target) {
    const w = Math.min(ZOOM_WIDTH, width);
    const h = (w * height) / width;
    box = {
      w,
      h,
      x: clamp(target.x + TABLE_W / 2 - w / 2, 0, width - w),
      y: clamp(target.y + TABLE_H / 2 - h / 2, 0, height - h),
    };
  }
  const showNumbers = labels || (zoomed && !!target);

  const byNumber = [...tables].sort((a, b) => a.n - b.n);
  const pathPoints = byNumber
    .map((t) => `${t.x + TABLE_W / 2},${t.y + TABLE_H / 2}`)
    .join(" ");

  const trackName = (id?: string) => coloured.find((t) => t.id === id)?.name;
  const scored = (n: number) => judgesScored?.[n];

  const summary =
    focusTable !== undefined
      ? `Room map. Table ${focusTable.n} is highlighted.`
      : highlightTrack
        ? `Room map. The ${trackName(highlightTrack) ?? "selected"} block is coloured.`
        : "Room map.";

  return (
    <div className="flex flex-col gap-3">
      {(searchable || listToggle) && (
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {searchable && (
            <>
              <label htmlFor="table-map-search" className="sr-only">
                Find a team or table
              </label>
              <input
                id="table-map-search"
                type="search"
                autoComplete="off"
                placeholder="Find a team or table number"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className={`${field} min-w-[200px] flex-1`}
              />
            </>
          )}
          {listToggle && (
            <div role="group" aria-label="Map or list" className="flex gap-2">
              <DashboardChip selected={view === "map"} onClick={() => setView("map")}>
                Map
              </DashboardChip>
              <DashboardChip selected={view === "list"} onClick={() => setView("list")}>
                List
              </DashboardChip>
            </div>
          )}
        </div>
      )}

      {searching && (
        <p role="status" className="m-0 text-sm text-dashboard-text-light print:hidden">
          {matches.length === 0
            ? "No team or table matches."
            : matches.length === 1 && matches[0]
              ? `${teams[matches[0].n] ?? "Table"} · Table ${matches[0].n}${
                  trackName(matches[0].trackId)
                    ? ` · ${trackName(matches[0].trackId)}`
                    : ""
                }`
              : `${matches.length} tables match.`}
        </p>
      )}

      {view === "map" ? (
        <svg
          viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
          role="img"
          aria-label={summary}
          className="block h-auto w-full"
        >
          <rect
            x={0}
            y={0}
            width={width}
            height={height}
            rx={6}
            className="fill-dashboard-bg-inset"
          />

          {byNumber.map((t) => {
            const track = trackOf(coloured, t.n);
            const isFocus = t.n === focus;
            const dim = searching && !matched.has(t.n);
            return (
              <g key={t.n} className={dim ? "opacity-30" : undefined}>
                <rect
                  x={t.x}
                  y={t.y}
                  width={TABLE_W}
                  height={TABLE_H}
                  rx={3}
                  strokeWidth={mineSet.has(t.n) ? 2 : 1}
                  className={
                    isFocus
                      ? "fill-dashboard-text-heavy stroke-dashboard-text-heavy"
                      : `${track?.fill ?? "fill-dashboard-bg-surface"} ${
                          mineSet.has(t.n)
                            ? "stroke-dashboard-action-primary"
                            : (track?.stroke ?? "stroke-dashboard-border-default")
                        }`
                  }
                />
              </g>
            );
          })}

          {showPath && (
            <polyline
              points={pathPoints}
              fill="none"
              strokeWidth={1}
              strokeDasharray="3 3"
              strokeLinejoin="round"
              className="stroke-dashboard-text-light opacity-60"
              pointerEvents="none"
            />
          )}

          {byNumber.map((t) => {
            const isFocus = t.n === focus;
            const dim = searching && !matched.has(t.n);
            const count = scored(t.n);
            const code = trackOf(coloured, t.n)?.code;
            const numberY = count !== undefined ? t.y + 8 : t.y + TABLE_H / 2;
            return (
              <g key={t.n} className={dim ? "opacity-30" : undefined}>
                {showNumbers && (
                  <text
                    x={t.x + TABLE_W / 2}
                    y={numberY}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={11}
                    fontWeight={isFocus ? 700 : 500}
                    className={
                      isFocus
                        ? "fill-dashboard-text-inverse"
                        : "fill-dashboard-text-heavy"
                    }
                  >
                    {t.n}
                  </text>
                )}
                {trackCodes && code && (
                  <text
                    x={t.x + 3}
                    y={t.y + TABLE_H - 3}
                    fontSize={6}
                    className="fill-dashboard-text-heavy"
                  >
                    {code}
                  </text>
                )}
                {count !== undefined &&
                  Array.from({ length: JUDGES_PER_TABLE }, (_, k) => (
                    <circle
                      key={k}
                      cx={t.x + TABLE_W / 2 + (k - (JUDGES_PER_TABLE - 1) / 2) * 6}
                      cy={t.y + TABLE_H - 5}
                      r={2}
                      strokeWidth={0.8}
                      className={
                        k < count
                          ? isFocus
                            ? "fill-dashboard-text-inverse stroke-dashboard-text-inverse"
                            : "fill-dashboard-text-heavy stroke-dashboard-text-heavy"
                          : isFocus
                            ? "fill-none stroke-dashboard-text-inverse"
                            : "fill-none stroke-dashboard-text-heavy"
                      }
                    />
                  ))}
              </g>
            );
          })}

          {focusTable && (
            <rect
              x={focusTable.x - 4}
              y={focusTable.y - 4}
              width={TABLE_W + 8}
              height={TABLE_H + 8}
              rx={6}
              strokeWidth={2.5}
              className="fill-none stroke-dashboard-action-primary"
            />
          )}
          {matches.map((t) => (
            <rect
              key={`match-${t.n}`}
              x={t.x - 3}
              y={t.y - 3}
              width={TABLE_W + 6}
              height={TABLE_H + 6}
              rx={5}
              strokeWidth={2.5}
              className="fill-none stroke-dashboard-action-primary"
            />
          ))}
        </svg>
      ) : (
        <TableList
          tables={byNumber}
          tracks={coloured}
          teams={teams}
          focus={focus}
          matched={searching ? matched : undefined}
          judgesScored={judgesScored}
        />
      )}

      {view === "map" && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-xs text-dashboard-text-light">
            {focusTable && (
              <li className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-block h-3 w-4 rounded-dashboard-xs bg-dashboard-text-heavy ring-2 ring-dashboard-action-primary ring-offset-1"
                />
                {focusLabel}
              </li>
            )}
            {mine.length > 0 && (
              <li className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-block h-3 w-4 rounded-dashboard-xs border-2 border-dashboard-action-primary"
                />
                {mineLabel}
              </li>
            )}
            {judgesScored && (
              <li className="flex items-center gap-2">
                <span aria-hidden className="font-mono">●●○</span>
                Judges who have scored it, out of {JUDGES_PER_TABLE}
              </li>
            )}
            {showPath && (
              <li className="flex items-center gap-2">
                <span aria-hidden className="inline-block w-4 border-t border-dashed border-dashboard-text-light" />
                Snake path, in table order
              </li>
            )}
            {showTrackLegend &&
              coloured.map((t) => (
                <li key={t.id} className="flex items-center gap-2">
                  <svg aria-hidden width={16} height={12} viewBox="0 0 16 12">
                    <rect x={0.5} y={0.5} width={15} height={11} rx={2} strokeWidth={1} className={`${t.fill} ${t.stroke}`} />
                  </svg>
                  {t.name} · tables {t.from}–{t.to}
                  {highlightTrack === t.id ? " (yours)" : ""}
                </li>
              ))}
          </ul>

          {zoomable && target && (
            <div role="group" aria-label="Map view" className="flex gap-2 print:hidden">
              <DashboardChip selected={!zoomed} onClick={() => setZoomed(false)}>
                Whole room
              </DashboardChip>
              <DashboardChip selected={zoomed} onClick={() => setZoomed(true)}>
                Near me
              </DashboardChip>
            </div>
          )}
        </div>
      )}

      {focus !== undefined && !focusTable && (
        <p className="m-0 text-sm text-dashboard-text-light">
          Table {focus} isn&apos;t on the map yet.
        </p>
      )}
    </div>
  );
}

interface TableListProps {
  tables: MapTable[];
  tracks: MapTrack[];
  teams: Record<number, string>;
  focus?: number;
  /** When set, only these tables are listed (a search is active). */
  matched?: Set<number>;
  judgesScored?: Record<number, number>;
}

/**
 * Numbered table list grouped by track. A plain-text twin of the map: it works
 * for screen readers, and it is the fallback if the live map isn't ready.
 */
export function TableList({
  tables,
  tracks,
  teams,
  focus,
  matched,
  judgesScored,
}: TableListProps) {
  const shown = matched ? tables.filter((t) => matched.has(t.n)) : tables;
  const groups = [
    ...tracks.map((track) => ({
      key: track.id,
      title: `${track.name} · tables ${track.from}–${track.to}`,
      rows: shown.filter((t) => t.trackId === track.id),
    })),
    {
      key: "none",
      title: tracks.length > 0 ? "Other tables" : "All tables",
      rows: shown.filter((t) => !tracks.some((track) => track.id === t.trackId)),
    },
  ].filter((g) => g.rows.length > 0);

  if (groups.length === 0) {
    return <p className="m-0 text-sm text-dashboard-text-light">Nothing to list.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map((g) => (
        <section key={g.key} aria-label={g.title} className="flex flex-col gap-1">
          <h3 className="m-0 text-sm font-semibold text-dashboard-text-light">{g.title}</h3>
          <ul className="m-0 flex list-none flex-col p-0">
            {g.rows.map((t) => {
              const count = judgesScored?.[t.n];
              return (
                <li
                  key={t.n}
                  className={`flex items-baseline gap-3 border-b border-dashboard-border-subtle py-1.5 text-base ${
                    t.n === focus ? "font-bold text-dashboard-text-heavy" : "text-dashboard-text-heavy"
                  }`}
                >
                  <span className="w-10 tabular-nums">{t.n}</span>
                  <span className="flex-1">{teams[t.n] ?? "No team yet"}</span>
                  {count !== undefined && (
                    <span className="text-sm tabular-nums text-dashboard-text-light">
                      {count} of {JUDGES_PER_TABLE}
                    </span>
                  )}
                  {t.n === focus && <span className="text-sm">← here</span>}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}