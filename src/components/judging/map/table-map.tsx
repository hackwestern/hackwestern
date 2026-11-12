import { useEffect, useRef, useState } from "react";

import { DashboardButton } from "~/components/internals/dashboard-button";
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
/** How far in you can zoom, relative to the whole-room view. */
const MAX_ZOOM = 8;
/** Table numbers appear once this much of the room (or less) is on screen. */
const NUMBERS_BELOW_WIDTH = 280;

const clamp = (n: number, min: number, max: number) =>
  Math.min(Math.max(n, min), max);

type Camera = { zoom: number; cx: number; cy: number };

/** The room turned a quarter turn clockwise. `h` is the unrotated map height. */
function rotateTables(tables: MapTable[], h: number): MapTable[] {
  return tables.map((t) => ({ ...t, x: h - (t.y + TABLE_H), y: t.x }));
}

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
  /** Always draw table numbers (they also appear when you zoom in). */
  labels?: boolean;
  /** Print each table's track letter, so a black and white copy still reads. */
  trackCodes?: boolean;
  showTrackLegend?: boolean;
  /** Search box for a team name or table number. */
  searchable?: boolean;
  /** Drag to move, pinch or buttons to zoom, "Near me" shortcut. */
  pannable?: boolean;
  /** A Full screen button that lets the map fill the whole screen. */
  fullscreenable?: boolean;
  /** Map / List switch. The list is also the fallback without the drawing. */
  listToggle?: boolean;
  /** Show the zoom, Whole room, Near me and Full screen buttons. */
  controls?: boolean;
  /**
   * Fill the height of the parent (which must be a flex column with a real
   * height). Starts fitted to the full height, drag sideways to see the rest,
   * with a small legend in the corner instead of below.
   */
  fill?: boolean;
  /** Makes the whole map one tap target, e.g. to open the map page. */
  onOpen?: () => void;
  /** With fill: a corner button that switches the room between horizontal and vertical. */
  rotateButton?: boolean;
  /** With fill: a corner button that snaps between the whole room and filling the screen. */
  fitButton?: boolean;
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
  pannable = true,
  fullscreenable = true,
  listToggle = false,
  controls = true,
  fill = false,
  onOpen,
  rotateButton = false,
  fitButton = false,
}: TableMapProps) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"map" | "list">("map");
  const [full, setFull] = useState(false);

  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const read = () => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, [view, full]);

  const q = query.trim().toLowerCase();
  const base = mapBounds(tables);
  // Fill mode: horizontal by default. The corner button turns the room
  // clockwise a quarter turn so the long side runs down the screen.
  const [turned, setTurned] = useState(false);
  const rotated = fill && turned && size.w > 0 && base.width > base.height;
  const shown = rotated ? rotateTables(tables, base.height) : tables;
  const tw = rotated ? TABLE_H : TABLE_W;
  const th = rotated ? TABLE_W : TABLE_H;

  const matches =
    q === ""
      ? []
      : shown.filter(
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

  const focusTable = shown.find((t) => t.n === focus);
  const target = matches.length === 1 ? matches[0] : focusTable;
  const width = rotated ? base.height : base.width;
  const height = rotated ? base.width : base.height;

  // ---- Camera: where the map is looking, and how far in --------------------
  const [cam, setCam] = useState<Camera>({
    zoom: 1,
    cx: width / 2,
    cy: height / 2,
  });

  // Pixels per map unit when the whole room fits, then times the zoom.
  const fit = size.w > 0 ? Math.min(size.w / width, size.h / height) : 1;
  const scale = fit * cam.zoom;
  const vw = size.w > 0 ? size.w / scale : width;
  const vh = size.h > 0 ? size.h / scale : height;
  const viewBox = `${cam.cx - vw / 2} ${cam.cy - vh / 2} ${vw} ${vh}`;

  const limit = (c: Camera): Camera => {
    const zoom = clamp(c.zoom, 1, MAX_ZOOM);
    if (!fill || size.w <= 0) {
      return { zoom, cx: clamp(c.cx, 0, width), cy: clamp(c.cy, 0, height) };
    }
    // Filling the screen: never pan past the edge of the room.
    const halfW = size.w / (fit * zoom) / 2;
    const halfH = size.h / (fit * zoom) / 2;
    const bound = (v: number, half: number, max: number) =>
      max <= 2 * half ? max / 2 : clamp(v, half, max - half);
    return {
      zoom,
      cx: bound(c.cx, halfW, width),
      cy: bound(c.cy, halfH, height),
    };
  };
  // The whole room at once, nothing cut off. This is the starting view.
  const homeCamera = (): Camera =>
    limit({ zoom: 1, cx: width / 2, cy: height / 2 });
  // Fill mode: zoomed so the room covers the whole screen, centred on the
  // focus table if there is one.
  const coverCamera = (): Camera => {
    if (size.w <= 0) return homeCamera();
    const cover = Math.max(size.w / width, size.h / height);
    return limit({
      zoom: cover / fit,
      cx: focusTable ? focusTable.x + tw / 2 : width / 2,
      cy: focusTable ? focusTable.y + th / 2 : height / 2,
    });
  };
  const resetCamera = () => setCam(homeCamera());
  const isFit = cam.zoom < 1.05;
  useEffect(() => {
    if (fill && size.w > 0) setCam(homeCamera());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fill, rotated, size.w, size.h, focus]);
  const panBy = (dx: number, dy: number) =>
    setCam((c) =>
      limit({
        ...c,
        cx: c.cx - dx / (fit * c.zoom),
        cy: c.cy - dy / (fit * c.zoom),
      }),
    );
  /** Zoom by `factor`, keeping the map point under (sx, sy) where it is. */
  const zoomAt = (sx: number, sy: number, factor: number) =>
    setCam((c) => {
      const zoom = clamp(c.zoom * factor, 1, MAX_ZOOM);
      const before = fit * c.zoom;
      const after = fit * zoom;
      const mx = c.cx + (sx - size.w / 2) / before;
      const my = c.cy + (sy - size.h / 2) / before;
      return limit({
        zoom,
        cx: mx - (sx - size.w / 2) / after,
        cy: my - (sy - size.h / 2) / after,
      });
    });
  const zoomCentre = (factor: number) => zoomAt(size.w / 2, size.h / 2, factor);
  const focusOn = (t: MapTable) =>
    setCam(
      limit({
        zoom: size.w > 0 ? size.w / ZOOM_WIDTH / fit : 2.5,
        cx: t.x + tw / 2,
        cy: t.y + th / 2,
      }),
    );

  // A search with one result flies to it.
  const matchKey = matches.length === 1 ? String(matches[0]?.n) : "";
  useEffect(() => {
    const only = matches.length === 1 ? matches[0] : undefined;
    if (only && pannable && size.w > 0) focusOn(only);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchKey]);

  // Mouse wheel zooms in full screen; elsewhere it needs Ctrl/Cmd so the page
  // can still scroll. Trackpad pinch arrives as Ctrl + wheel.
  useEffect(() => {
    const el = boxRef.current;
    if (!el || !pannable) return;
    const onWheel = (e: WheelEvent) => {
      if (!(full || e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(
        e.clientX - r.left,
        e.clientY - r.top,
        Math.exp(-e.deltaY * 0.0025),
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  // One finger or mouse drags the map; two fingers pinch it.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const lastPinch = useRef<number | null>(null);
  const local = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pannable) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, local(e));
    lastPinch.current = null;
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev || !pannable) return;
    const now = local(e);
    pointers.current.set(e.pointerId, now);
    const all = Array.from(pointers.current.values());
    const [a, b] = all;
    if (all.length >= 2 && a && b) {
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (lastPinch.current) zoomAt(mid.x, mid.y, dist / lastPinch.current);
      lastPinch.current = dist;
    } else {
      panBy(now.x - prev.x, now.y - prev.y);
    }
  };
  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    lastPinch.current = null;
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!pannable) return;
    const step = 60;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const move = moves[e.key];
    if (move) panBy(move[0], move[1]);
    else if (e.key === "+" || e.key === "=") zoomCentre(1.4);
    else if (e.key === "-") zoomCentre(1 / 1.4);
    else if (e.key === "0") resetCamera();
    else return;
    e.preventDefault();
  };

  // ---- Full screen ---------------------------------------------------------
  const toggleFull = () => {
    setFull((f) => !f);
    resetCamera();
  };
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFull(false);
        resetCamera();
      }
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full]);

  const showNumbers = labels || vw <= NUMBERS_BELOW_WIDTH;
  const zoomedIn = cam.zoom > 1.05;

  const byNumber = [...shown].sort((a, b) => a.n - b.n);
  const pathPoints = byNumber
    .map((t) => `${t.x + tw / 2},${t.y + th / 2}`)
    .join(" ");

  const trackName = (id?: string) => coloured.find((t) => t.id === id)?.name;
  const scored = (n: number) => judgesScored?.[n];

  const summary =
    focusTable !== undefined
      ? `Room map. Table ${focusTable.n} is highlighted.`
      : highlightTrack
        ? `Room map. The ${trackName(highlightTrack) ?? "selected"} block is coloured.`
        : "Room map.";

  const legendClass = fill
    ? "m-0 flex list-none flex-col gap-0.5 p-0 text-[11px] leading-tight text-dashboard-text-light"
    : `m-0 flex list-none flex-col gap-1 p-0 text-xs text-dashboard-text-light ${
        full ? "max-h-28 overflow-y-auto" : ""
      }`;
  const legend = (
    <ul className={legendClass}>
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
          <span aria-hidden className="font-mono">
            ●●○
          </span>
          Judges who have scored it, out of {JUDGES_PER_TABLE}
        </li>
      )}
      {showPath && (
        <li className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block w-4 border-t border-dashed border-dashboard-text-light"
          />
          Snake path, in table order
        </li>
      )}
      {showTrackLegend &&
        coloured.map((t) => (
          <li key={t.id} className="flex items-center gap-2">
            <svg aria-hidden width={16} height={12} viewBox="0 0 16 12">
              <rect
                x={0.5}
                y={0.5}
                width={15}
                height={11}
                rx={2}
                strokeWidth={1}
                className={`${t.fill} ${t.stroke}`}
              />
            </svg>
            {t.name} · tables {t.from}–{t.to}
            {highlightTrack === t.id ? " (yours)" : ""}
          </li>
        ))}
    </ul>
  );

  return (
    <div
      className={
        full
          ? "fixed inset-0 z-50 flex flex-col gap-3 overflow-hidden bg-dashboard-bg-page p-3"
          : fill
            ? "relative flex min-h-0 flex-1 flex-col"
            : "flex flex-col gap-3"
      }
    >
      {full && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-base font-bold text-dashboard-text-heavy">
            Room map
          </span>
          <DashboardButton
            type="button"
            variant="outline"
            onClick={toggleFull}
            className="min-h-11 w-auto md:w-auto"
          >
            Close
          </DashboardButton>
        </div>
      )}

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
              <DashboardChip
                selected={view === "map"}
                onClick={() => setView("map")}
              >
                Map
              </DashboardChip>
              <DashboardChip
                selected={view === "list"}
                onClick={() => setView("list")}
              >
                List
              </DashboardChip>
            </div>
          )}
        </div>
      )}

      {searching && (
        <p
          role="status"
          className="m-0 text-sm text-dashboard-text-light print:hidden"
        >
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

      {view === "map" && controls && (pannable || fullscreenable) && (
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {pannable && (
            <>
              <DashboardChip
                selected={false}
                onClick={() => zoomCentre(1 / 1.4)}
              >
                Zoom out −
              </DashboardChip>
              <DashboardChip selected={false} onClick={() => zoomCentre(1.4)}>
                Zoom in +
              </DashboardChip>
              <DashboardChip selected={!zoomedIn} onClick={resetCamera}>
                Whole room
              </DashboardChip>
              {target && (
                <DashboardChip selected={false} onClick={() => focusOn(target)}>
                  Near {focusTable && target === focusTable ? "me" : "result"}
                </DashboardChip>
              )}
            </>
          )}
          {fullscreenable && !full && (
            <DashboardChip selected={false} onClick={toggleFull}>
              Full screen
            </DashboardChip>
          )}
        </div>
      )}

      {view === "map" ? (
        <div
          ref={boxRef}
          role={onOpen && !pannable ? "button" : "group"}
          aria-label={
            onOpen && !pannable
              ? `${summary} Open the map.`
              : `${summary}${pannable ? " Arrow keys move, plus and minus zoom." : ""}`
          }
          tabIndex={pannable || onOpen ? 0 : undefined}
          onClick={onOpen}
          onKeyDown={(e) => {
            if (onOpen && !pannable) {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen();
              }
              return;
            }
            onKeyDown(e);
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          style={{
            aspectRatio: full || fill ? undefined : `${width} / ${height}`,
            // Page scroll stays available until the map is zoomed or full screen.
            touchAction: !pannable
              ? undefined
              : full || fill || zoomedIn
                ? "none"
                : "pan-y",
          }}
          className={`relative w-full select-none overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-dashboard-action-primary ${
            fill ? "bg-dashboard-bg-inset" : "rounded-dashboard-lg"
          } ${full || fill ? "min-h-0 flex-1" : ""} ${
            onOpen && !pannable
              ? "cursor-pointer"
              : pannable && (zoomedIn || full || fill)
                ? "cursor-grab active:cursor-grabbing"
                : ""
          }`}
        >
          <svg
            viewBox={viewBox}
            role="img"
            aria-label={summary}
            className="absolute inset-0 block h-full w-full"
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
                    width={tw}
                    height={th}
                    rx={3}
                    strokeWidth={mineSet.has(t.n) ? 2 : 1}
                    className={
                      isFocus
                        ? "fill-dashboard-text-heavy stroke-dashboard-text-heavy"
                        : `${track?.fill ?? "fill-dashboard-bg-surface"} ${
                            mineSet.has(t.n)
                              ? "stroke-dashboard-action-primary"
                              : (track?.stroke ??
                                "stroke-dashboard-border-default")
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
              const numberY = count !== undefined ? t.y + 8 : t.y + th / 2;
              return (
                <g key={t.n} className={dim ? "opacity-30" : undefined}>
                  {showNumbers && (
                    <text
                      x={t.x + tw / 2}
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
                      y={t.y + th - 3}
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
                        cx={t.x + tw / 2 + (k - (JUDGES_PER_TABLE - 1) / 2) * 6}
                        cy={t.y + th - 5}
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
                width={tw + 8}
                height={th + 8}
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
                width={tw + 6}
                height={th + 6}
                rx={5}
                strokeWidth={2.5}
                className="fill-none stroke-dashboard-action-primary"
              />
            ))}
          </svg>
          {fill && (
            <div className="pointer-events-none absolute bottom-3 left-3 rounded-dashboard-lg border border-dashboard-border-default bg-dashboard-bg-surface px-2.5 py-2">
              {legend}
            </div>
          )}
        </div>
      ) : (
        <div className={full ? "min-h-0 flex-1 overflow-y-auto" : undefined}>
          <TableList
            tables={byNumber}
            tracks={coloured}
            teams={teams}
            focus={focus}
            matched={searching ? matched : undefined}
            judgesScored={judgesScored}
          />
        </div>
      )}

      {fill && (rotateButton || fitButton) && view === "map" && (
        <div className="absolute right-3 top-3 z-10 flex gap-2">
          {rotateButton && (
            <DashboardButton
              type="button"
              variant="outline"
              aria-pressed={turned}
              onClick={() => setTurned((t) => !t)}
              className="min-h-11 w-auto bg-dashboard-bg-surface px-3 md:w-auto"
            >
              {turned ? "Horizontal" : "Vertical"}
            </DashboardButton>
          )}
          {fitButton && (
            <DashboardButton
              type="button"
              variant="outline"
              onClick={() => setCam(isFit ? coverCamera() : homeCamera())}
              className="min-h-11 w-auto bg-dashboard-bg-surface px-3 md:w-auto"
            >
              {isFit ? "Fill screen" : "Fit to screen"}
            </DashboardButton>
          )}
        </div>
      )}

      {view === "map" && !fill && legend}

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
      rows: shown.filter(
        (t) => !tracks.some((track) => track.id === t.trackId),
      ),
    },
  ].filter((g) => g.rows.length > 0);

  if (groups.length === 0) {
    return (
      <p className="m-0 text-sm text-dashboard-text-light">Nothing to list.</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map((g) => (
        <section
          key={g.key}
          aria-label={g.title}
          className="flex flex-col gap-1"
        >
          <h3 className="m-0 text-sm font-semibold text-dashboard-text-light">
            {g.title}
          </h3>
          <ul className="m-0 flex list-none flex-col p-0">
            {g.rows.map((t) => {
              const count = judgesScored?.[t.n];
              return (
                <li
                  key={t.n}
                  className={`flex items-baseline gap-3 border-b border-dashboard-border-subtle py-1.5 text-base ${
                    t.n === focus
                      ? "font-bold text-dashboard-text-heavy"
                      : "text-dashboard-text-heavy"
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
