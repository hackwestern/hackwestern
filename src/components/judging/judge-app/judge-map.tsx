import { useState } from "react";

import { focusRing } from "~/components/judging/shared/judge-ui";
import {
  TABLE_H,
  TABLE_W,
  VENUE_HEIGHT,
  VENUE_TABLES,
  VENUE_WIDTH,
} from "~/components/judging/judge-app/judge-map-layout";

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
          fill="#f6f7fa"
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
                fill={isMine ? "#e6defa" : "#ffffff"}
                stroke={isMine ? "#5b3fa0" : "#c3cad8"}
                strokeWidth={1}
              />
              {showLabels && (
                <text
                  x={t.x + TABLE_W / 2}
                  y={t.y + TABLE_H / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={11}
                  fill="#0b2238"
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
              fill="none"
              stroke="#5b3fa0"
              strokeWidth={2.5}
            />
            <rect
              x={here.x}
              y={here.y}
              width={TABLE_W}
              height={TABLE_H}
              rx={3}
              fill="#0b2238"
            />
            {showLabels && (
              <text
                x={here.x + TABLE_W / 2}
                y={here.y + TABLE_H / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={12}
                fontWeight={700}
                fill="#ffffff"
              >
                {here.n}
              </text>
            )}
          </g>
        )}
      </svg>

      {current !== undefined && !here && (
        <p className="m-0 text-[13px] text-[#4a5d73]">
          Table {current} isn&apos;t on the map yet.
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px] text-[#4a5d73]">
          <li className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-3 w-4 rounded-[3px] bg-[#0b2238] ring-2 ring-[#5b3fa0] ring-offset-1"
            />
            Next table
          </li>
          <li className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-3 w-4 rounded-[3px] border border-[#5b3fa0] bg-[#e6defa]"
            />
            Your other tables
          </li>
        </ul>

        <div role="group" aria-label="Map view" className="flex">
          {(
            [
              { id: false, text: "Whole room" },
              { id: true, text: "Near me" },
            ] as const
          ).map((o, i) => {
            const on = zoomed === o.id;
            return (
              <button
                key={o.text}
                type="button"
                aria-pressed={on}
                disabled={o.id && !here}
                onClick={() => setZoomed(o.id)}
                className={`min-h-[44px] border-[1.5px] px-3 text-sm font-semibold disabled:opacity-40 ${
                  i === 0 ? "rounded-l-xl" : "-ml-[1.5px] rounded-r-xl"
                } ${
                  on
                    ? "relative border-[#5b3fa0] bg-[#5b3fa0] text-white"
                    : "border-[#c3cad8] bg-white text-[#0b2238] enabled:hover:bg-[#f6f7fa]"
                } ${focusRing}`}
              >
                {o.text}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}