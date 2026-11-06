import { useState } from "react";

import { DashboardChip } from "~/components/internals/dashboard-chip";
import {
  TABLE_H,
  TABLE_W,
  VENUE_HEIGHT,
  VENUE_TABLES,
  VENUE_WIDTH,
} from "../judge-app/judge-map-layout";

/** Width of the "Near me" view, in map units. About five tables across. */
const ZOOM_WIDTH = 210;

const clamp = (n: number, min: number, max: number) =>
  Math.min(Math.max(n, min), max);

interface VenueMapProps {
  /** Every table this judge covers. */
  tables: number[];
  /** The table to go to now. */
  current: number | undefined;
}

/** Floor map with the current table highlighted. "Near me" zooms in on it. */
export function VenueMap({ tables, current }: VenueMapProps) {
  const [zoomed, setZoomed] = useState(false);
  const mine = new Set(tables);
  const here = VENUE_TABLES.find((t) => t.n === current);

  let box = { x: 0, y: 0, w: VENUE_WIDTH, h: VENUE_HEIGHT };
  if (zoomed && here) {
    const w = ZOOM_WIDTH;
    const h = (ZOOM_WIDTH * VENUE_HEIGHT) / VENUE_WIDTH;
    box = {
      w,
      h,
      x: clamp(here.x + TABLE_W / 2 - w / 2, 0, VENUE_WIDTH - w),
      y: clamp(here.y + TABLE_H / 2 - h / 2, 0, VENUE_HEIGHT - h),
    };
  }
  const showLabels = zoomed && here !== undefined;

  const label =
    here !== undefined
      ? `Floor map. Table ${here.n} is highlighted.`
      : "Floor map.";

  return (
    <div className="flex flex-col gap-3">
      <svg
        viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
        role="img"
        aria-label={label}
        className="block h-auto w-full"
      >
        <rect
          x={0}
          y={0}
          width={VENUE_WIDTH}
          height={VENUE_HEIGHT}
          rx={6}
          className="fill-dashboard-bg-inset"
        />
        {VENUE_TABLES.filter((t) => t.n !== current).map((t) => {
          const isMine = mine.has(t.n);
          return (
            <g key={t.n}>
              <rect
                x={t.x}
                y={t.y}
                width={TABLE_W}
                height={TABLE_H}
                rx={3}
                strokeWidth={1}
                className={
                  isMine
                    ? "fill-dashboard-bg-highlight stroke-dashboard-action-primary"
                    : "fill-dashboard-bg-surface stroke-dashboard-border-default"
                }
              />
              {showLabels && (
                <text
                  x={t.x + TABLE_W / 2}
                  y={t.y + TABLE_H / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={11}
                  className="fill-dashboard-text-heavy"
                >
                  {t.n}
                </text>
              )}
            </g>
          );
        })}
        {here && (
          <g>
            <rect
              x={here.x - 4}
              y={here.y - 4}
              width={TABLE_W + 8}
              height={TABLE_H + 8}
              rx={6}
              strokeWidth={2.5}
              className="fill-none stroke-dashboard-action-primary"
            />
            <rect
              x={here.x}
              y={here.y}
              width={TABLE_W}
              height={TABLE_H}
              rx={3}
              className="fill-dashboard-text-heavy"
            />
            {showLabels && (
              <text
                x={here.x + TABLE_W / 2}
                y={here.y + TABLE_H / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={12}
                fontWeight={700}
                className="fill-dashboard-text-inverse"
              >
                {here.n}
              </text>
            )}
          </g>
        )}
      </svg>

      {current !== undefined && !here && (
        <p className="m-0 text-sm text-dashboard-text-light">
          Table {current} isn&apos;t on the map yet.
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-xs text-dashboard-text-light">
          <li className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-3 w-4 rounded-dashboard-xs bg-dashboard-text-heavy ring-2 ring-dashboard-action-primary ring-offset-1"
            />
            Next table
          </li>
          <li className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-3 w-4 rounded-dashboard-xs border border-dashboard-action-primary bg-dashboard-bg-highlight"
            />
            Your other tables
          </li>
        </ul>

        {/* "Near me" only exists when there is a table on the map to zoom to. */}
        {here && (
          <div role="group" aria-label="Map view" className="flex gap-2">
            <DashboardChip selected={!zoomed} onClick={() => setZoomed(false)}>
              Whole room
            </DashboardChip>
            <DashboardChip selected={zoomed} onClick={() => setZoomed(true)}>
              Near me
            </DashboardChip>
          </div>
        )}
      </div>
    </div>
  );
}