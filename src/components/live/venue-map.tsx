"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DashboardChip } from "~/components/internals/dashboard-chip";
import { HACKATHON_START } from "~/lib/date";
import { fetchScheduleData } from "~/lib/schedule";
import {
  BOUNDS,
  DAYS,
  FLOORS,
  IVEY,
  IVEY_ADDRESS,
  ROOMS,
  ZONES,
  eventsFromSchedule,
  formatRange,
  formatTime,
  type DayIndex,
  type Floor,
  type Point,
  type Room,
  type RoomEvent,
} from "~/lib/venue-map";

type View = { tx: number; ty: number; k: number };
type Size = { w: number; h: number };

const bounds = (f: Floor) => {
  const b = BOUNDS[f];
  return { ...b, w: b.x1 - b.x0, h: b.y1 - b.y0 };
};
const sameBuilding = (a: Floor, b: Floor) => (a === IVEY) === (b === IVEY);
const where = (f: Floor) => (f === IVEY ? "Ivey building" : `Level ${f}`);
// Same breakpoint as Tailwind's md: below it the room card is a bottom sheet
const NARROW = "(max-width: 767px)";

const points = (p: Point[]) => p.map((q) => q.join(",")).join(" ");
const pathD = (p: Point[]) => `M${p.map((q) => q.join(" ")).join("L")}Z`;
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

function centroid(p: Point[]): Point {
  let a = 0;
  let cx = 0;
  let cy = 0;
  p.forEach(([x0, y0], i) => {
    const [x1, y1] = p[(i + 1) % p.length]!;
    const f = x0 * y1 - x1 * y0;
    a += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  });
  a /= 2;
  return [cx / (6 * a), cy / (6 * a)];
}

function size(p: Point[]) {
  const xs = p.map((q) => q[0]);
  const ys = p.map((q) => q[1]);
  return {
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
  };
}

// Blend a zone colour with white, for room fills
function tint(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c * amount + 255 * (1 - amount));
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(mix);
  return `rgb(${r},${g},${b})`;
}

const GEO = Object.fromEntries(
  ROOMS.map((r) => {
    const s = size(r.poly);
    const rotated = !(r.poly.length === 4 && r.poly[0]![1] === r.poly[1]![1]);
    return [r.id, { c: centroid(r.poly), ...s, rotated }];
  }),
);
const ROOM_BY_ID = Object.fromEntries(ROOMS.map((r) => [r.id, r]));

// 0: no label, 1: room number, 2: short name + number, 3: full name + number
function labelDetail(r: Room, k: number) {
  if (r.place) return 2; // the help desk has no number and is always labelled
  const g = GEO[r.id]!;
  const base = g.rotated ? Math.min(g.w, g.h) * 0.75 : null;
  const w = (base ?? g.w * 0.9) * k;
  const h = (base ?? g.h * 0.85) * k;
  let d = 0;
  if (w > 26 && h > 16) d = 1;
  if (d && h > 34) {
    if (w > r.short.length * 6.4 + 8) d = 2;
    if (w > r.name.length * 6.4 + 8) d = 3;
  }
  return d;
}

// Space the room card and controls take up, so the plan isn't drawn under them
function padding(s: Size, narrow: boolean, card: boolean) {
  return narrow
    ? { l: 12, r: 12, t: 64, b: card ? s.h * 0.55 : 64 }
    : { l: 20, r: card ? 372 : 20, t: 68, b: 56 };
}

function fitView(s: Size, narrow: boolean, card: boolean, floor: Floor): View {
  const BB = bounds(floor);
  const p = padding(s, narrow, card);
  const aw = s.w - p.l - p.r;
  const ah = s.h - p.t - p.b;
  const k = Math.min(aw / BB.w, ah / BB.h);
  return {
    k,
    tx: p.l + aw / 2 - (BB.x0 + BB.w / 2) * k,
    ty: p.t + ah / 2 - (BB.y0 + BB.h / 2) * k,
  };
}

function focusView(r: Room, s: Size, narrow: boolean): View {
  const p = padding(s, narrow, true);
  const aw = s.w - p.l - p.r;
  const ah = s.h - p.t - p.b;
  const g = GEO[r.id]!;
  const fitK = fitView(s, narrow, false, r.floor).k;
  const k = clamp(
    Math.min((aw * 0.45) / g.w, (ah * 0.45) / g.h),
    fitK * 1.6,
    fitK * 4,
  );
  return { k, tx: p.l + aw / 2 - g.c[0] * k, ty: p.t + ah / 2 - g.c[1] * k };
}

// Friday = 0 during the event, otherwise null
function eventDay(): DayIndex | null {
  const d = Math.floor((Date.now() - HACKATHON_START.getTime()) / 86_400_000);
  return d >= 0 && d <= 2 ? (d as DayIndex) : null;
}

const reduceMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type Hit = { room: Room; event?: RoomEvent };

/** A room to outline and label, e.g. a sponsor's booth or workshop room */
export type VenueMapHighlight = {
  /** Room id from ~/lib/venue-map */
  room: string;
  label: string;
  /** data-tour id for the room's button in the list under the map */
  tour?: string;
};

type VenueMapProps = {
  /** Outlined on the plan and listed under it. None on /live. */
  highlights?: VenueMapHighlight[];
  /** Names the list of highlighted rooms */
  highlightsLabel?: string;
  /** The floor shown first (default SEI level 1) */
  initialFloor?: Floor;
};

const NO_HIGHLIGHTS: VenueMapHighlight[] = [];

const VenueMap = ({
  highlights = NO_HIGHLIGHTS,
  highlightsLabel,
  initialFloor = 1,
}: VenueMapProps = {}) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [stage, setStage] = useState<Size>({ w: 0, h: 0 });
  const [narrow, setNarrow] = useState(false);
  const [floor, setFloor] = useState<Floor>(initialFloor);
  // The SEI level to go back to after looking at Ivey
  const seiLevel = useRef<Floor>(initialFloor === IVEY ? 1 : initialFloor);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [day, setDay] = useState<DayIndex | null>(null);
  const [events, setEvents] = useState<RoomEvent[]>([]);
  const [view, setView] = useState<View>({ tx: 0, ty: 0, k: 0 });
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [active, setActive] = useState(0);

  const viewRef = useRef(view);
  viewRef.current = view;
  const userMoved = useRef(false);
  const frame = useRef(0);
  const selected = selectedId ? ROOM_BY_ID[selectedId] : undefined;
  // Room id -> its highlights, in the order given (rooms not on the map are dropped)
  const marked = useMemo(() => {
    const m = new Map<string, VenueMapHighlight[]>();
    for (const h of highlights) {
      if (!ROOM_BY_ID[h.room]) continue;
      m.set(h.room, [...(m.get(h.room) ?? []), h]);
    }
    return m;
  }, [highlights]);
  const markLabel = (id: string) =>
    marked
      .get(id)
      ?.map((h) => h.label)
      .join(" · ");
  const fitK = stage.w ? fitView(stage, narrow, false, floor).k : 1;

  useEffect(() => {
    void fetchScheduleData().then((d) => setEvents(eventsFromSchedule(d)));
  }, []);

  useEffect(() => {
    const mq = window.matchMedia(NARROW);
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      setStage({ w: el.clientWidth, h: el.clientHeight }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const animateTo = useCallback((target: View) => {
    cancelAnimationFrame(frame.current);
    const from = viewRef.current;
    if (reduceMotion() || !from.k) {
      setView(target);
      return;
    }
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / 450);
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      setView({
        tx: from.tx + (target.tx - from.tx) * e,
        ty: from.ty + (target.ty - from.ty) * e,
        k: Math.exp(
          Math.log(from.k) + (Math.log(target.k) - Math.log(from.k)) * e,
        ),
      });
      if (p < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  }, []);

  // Keep the plan framed when the page resizes, unless someone moved it
  useEffect(() => {
    if (!stage.w || userMoved.current) return;
    cancelAnimationFrame(frame.current);
    setView(
      selected
        ? focusView(selected, stage, narrow)
        : fitView(stage, narrow, false, floor),
    );
    // Only on size changes; selection changes animate in select()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.w, stage.h, narrow]);

  const select = useCallback(
    (id: string | null, preferDay: DayIndex | null = null) => {
      userMoved.current = false;
      setDay(preferDay);
      setSelectedId(id);
      if (!stage.w) return;
      const r = id ? ROOM_BY_ID[id] : undefined;
      if (r) {
        setFloor(r.floor);
        if (r.floor !== IVEY) seiLevel.current = r.floor;
        const target = focusView(r, stage, narrow);
        // The buildings have separate plans, so there's nothing to animate between
        if (sameBuilding(r.floor, floor)) animateTo(target);
        else {
          cancelAnimationFrame(frame.current);
          setView(target);
        }
      } else {
        animateTo(fitView(stage, narrow, false, floor));
      }
    },
    [stage, narrow, floor, animateTo],
  );

  const showBuilding = (ivey: boolean) => {
    if (ivey === (floor === IVEY)) return;
    const f = ivey ? IVEY : seiLevel.current;
    cancelAnimationFrame(frame.current);
    userMoved.current = false;
    setSelectedId(null);
    setDay(null);
    setFloor(f);
    if (stage.w) setView(fitView(stage, narrow, false, f));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedId) select(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectedId, select]);

  // ---------- pan and zoom ----------

  const zoomAt = useCallback(
    (x: number, y: number, factor: number) => {
      cancelAnimationFrame(frame.current);
      userMoved.current = true;
      setView((v) => {
        const k = clamp(v.k * factor, fitK * 0.7, fitK * 12);
        const r = k / v.k;
        return { k, tx: x - (x - v.tx) * r, ty: y - (y - v.ty) * r };
      });
    },
    [fitK],
  );

  // Trackpad pinch arrives as ctrl + wheel; plain scrolling still scrolls the page.
  // React's onWheel is passive, so this needs a native listener.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      zoomAt(
        e.clientX - rect.left,
        e.clientY - rect.top,
        Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002)),
      );
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    drag?: { x: number; y: number; tx: number; ty: number };
    pinch?: { d: number; k: number; wx: number; wy: number };
    moved: boolean;
  }>({ moved: false });

  const local = (x: number, y: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: x - rect.left, y: y - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    cancelAnimationFrame(frame.current);
    const ps = pointers.current;
    const g = gesture.current;
    ps.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ps.size === 1) {
      g.moved = false;
      g.drag = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
    }
    if (ps.size === 2) {
      const [a, b] = [...ps.values()] as [
        { x: number; y: number },
        { x: number; y: number },
      ];
      const c = local((a.x + b.x) / 2, (a.y + b.y) / 2);
      g.pinch = {
        d: Math.hypot(a.x - b.x, a.y - b.y),
        k: view.k,
        wx: (c.x - view.tx) / view.k,
        wy: (c.y - view.ty) / view.k,
      };
      g.drag = undefined;
      g.moved = true;
    }
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const ps = pointers.current;
    const g = gesture.current;
    if (!ps.has(e.pointerId)) return;
    ps.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ps.size === 2 && g.pinch) {
      const [a, b] = [...ps.values()] as [
        { x: number; y: number },
        { x: number; y: number },
      ];
      const c = local((a.x + b.x) / 2, (a.y + b.y) / 2);
      const pinch = g.pinch;
      const k = clamp(
        (pinch.k * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.d,
        fitK * 0.7,
        fitK * 12,
      );
      userMoved.current = true;
      setView({ k, tx: c.x - pinch.wx * k, ty: c.y - pinch.wy * k });
    } else if (g.drag) {
      const dx = e.clientX - g.drag.x;
      const dy = e.clientY - g.drag.y;
      if (!g.moved && Math.hypot(dx, dy) > 5) {
        g.moved = true;
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      if (g.moved) {
        const drag = g.drag;
        userMoved.current = true;
        setView((v) => ({ ...v, tx: drag.tx + dx, ty: drag.ty + dy }));
      }
    }
  };

  const onPointerEnd = (e: React.PointerEvent<SVGSVGElement>) => {
    const ps = pointers.current;
    ps.delete(e.pointerId);
    if (ps.size < 2) gesture.current.pinch = undefined;
    if (!ps.size) gesture.current.drag = undefined;
  };

  const onClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (gesture.current.moved) {
      gesture.current.moved = false;
      return;
    }
    const el = (e.target as Element).closest<SVGElement>("[data-room]");
    if (el?.dataset.room) select(el.dataset.room);
    else if (selectedId) select(null);
  };

  const zoomCenter = (factor: number) =>
    zoomAt(stage.w / 2, stage.h / 2, factor);

  // ---------- search ----------

  const hits: Hit[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const rooms = ROOMS.filter((r) =>
      [r.name, r.short, r.id, r.place ?? "", r.keywords ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q),
    ).map((room) => ({ room }));
    // One result per event and building (coffee chats run in eight rooms)
    const evs = events
      .filter((ev) => ev.title.toLowerCase().includes(q))
      .flatMap((ev) => {
        const rooms = ev.rooms.map((id) => ROOM_BY_ID[id]!);
        const sei = rooms.find((r) => r.floor !== IVEY);
        const ivey = rooms.find((r) => r.floor === IVEY);
        return [sei, ivey]
          .filter((r): r is Room => !!r)
          .map((room) => ({ room, event: ev }));
      })
      .slice(0, 8);
    return [...rooms, ...evs];
  }, [query, events]);

  const pick = (h: Hit) => {
    setQuery("");
    setSearchOpen(false);
    select(h.room.id, h.event?.day ?? null);
  };

  // ---------- room card ----------

  const roomEvents = selected
    ? events.filter((ev) => ev.rooms.includes(selected.id))
    : [];
  const days = [...new Set(roomEvents.map((ev) => ev.day))];
  const today = eventDay();
  const shownDay =
    day !== null && days.includes(day)
      ? day
      : today !== null && days.includes(today)
        ? today
        : days[0];
  const shownEvents = roomEvents.filter((ev) => ev.day === shownDay);

  const plan = FLOORS[floor];
  const zonesShown = (Object.keys(ZONES) as (keyof typeof ZONES)[]).filter(
    (z) => ROOMS.some((r) => r.zone === z && sameBuilding(r.floor, floor)),
  );

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex gap-6 border-b border-dashboard-border-subtle font-figtree"
        role="group"
        aria-label="Building"
      >
        {[
          { label: "SEI building", ivey: false },
          { label: "Ivey building", ivey: true },
        ].map((b) => {
          const on = b.ivey === (floor === IVEY);
          return (
            <button
              key={b.label}
              type="button"
              aria-pressed={on}
              onClick={() => showBuilding(b.ivey)}
              className={`-mb-px border-b-2 pb-2 text-base transition-colors ${on ? "border-dashboard-action-primary font-bold text-dashboard-text-heavy" : "border-transparent font-medium text-dashboard-text-light hover:text-dashboard-text-heavy"}`}
            >
              {b.label}
            </button>
          );
        })}
      </div>
      <div
        ref={stageRef}
        className="relative h-[calc(100dvh-170px)] min-h-[440px] overflow-hidden rounded-dashboard-lg border border-dashboard-border-subtle bg-dashboard-bg-surface font-figtree shadow-dashboard-card md:h-[calc(100dvh-280px)] md:min-h-[520px]"
      >
        <svg
          ref={svgRef}
          className="absolute inset-0 h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
          viewBox={`0 0 ${stage.w || 1} ${stage.h || 1}`}
          role="img"
          aria-label={`Floor plan, ${floor === IVEY ? "Ivey building" : `SEI level ${floor}`}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onClick={onClick}
        >
          <defs>
            <pattern
              id="venue-hatch"
              width="9"
              height="9"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="9"
                stroke="#6F829A"
                strokeOpacity="0.3"
                strokeWidth="1.4"
              />
            </pattern>
            <clipPath id={`venue-clip-${floor}`}>
              <path d={pathD(plan.outline)} />
            </clipPath>
          </defs>
          {view.k > 0 && (
            <g transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
              <path d={pathD(plan.outline)} fill="#F1F5FA" />
              <g clipPath={`url(#venue-clip-${floor})`}>
                {plan.voids.map((v, i) => (
                  <polygon
                    key={i}
                    points={points(v)}
                    fill="url(#venue-hatch)"
                    stroke="#6F829A"
                    strokeOpacity="0.5"
                    strokeDasharray="5 4"
                    strokeWidth="1.2"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {plan.service.map((s, i) => (
                  <polygon
                    key={i}
                    points={points(s)}
                    fill="#DCE5F0"
                    stroke="#F1F5FA"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {plan.rooms.map((r) => {
                  const color = ZONES[r.zone].color;
                  const isSel = r.id === selectedId;
                  return (
                    <polygon
                      key={r.id}
                      data-room={r.id}
                      points={points(r.poly)}
                      fill={tint(
                        color,
                        isSel ? 0.5 : r.zone === "help" ? 0.6 : 0.28,
                      )}
                      stroke={isSel ? color : "#F1F5FA"}
                      strokeWidth={isSel ? 3.5 : 2.5}
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                      opacity={selectedId && !isSel ? 0.5 : 1}
                      className="cursor-pointer transition-opacity hover:brightness-95"
                    >
                      <title>{`${r.name}${r.place ? "" : `, room ${r.id}`}`}</title>
                    </polygon>
                  );
                })}
              </g>
              <path
                d={pathD(plan.outline)}
                fill="none"
                stroke="#6F829A"
                strokeWidth="1.6"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
              {marked.size > 0 && (
                <g
                  pointerEvents="none"
                  clipPath={`url(#venue-clip-${floor})`}
                  className="text-dashboard-action-primary"
                >
                  {plan.rooms
                    .filter((r) => marked.has(r.id))
                    .map((r) => (
                      <polygon
                        key={r.id}
                        points={points(r.poly)}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                </g>
              )}
              <g pointerEvents="none" textAnchor="middle">
                {plan.rooms.map((r) => {
                  const detail = labelDetail(r, view.k);
                  if (!detail) return null;
                  const [cx, cy] = GEO[r.id]!.c;
                  const dim = selectedId && r.id !== selectedId;
                  const name = detail === 3 ? r.name : r.short;
                  const number = r.place ? "" : r.id;
                  // A highlight's label sits above the room name once the room is big enough
                  const mark = detail >= 2 ? markLabel(r.id) : undefined;
                  const markW = mark ? mark.length * 6.2 + 16 : 0;
                  return (
                    <g
                      key={r.id}
                      transform={`translate(${cx} ${cy}) scale(${1 / view.k})`}
                      opacity={dim ? 0.55 : 1}
                      stroke="rgba(255,255,255,0.85)"
                      strokeWidth="3"
                      strokeLinejoin="round"
                      paintOrder="stroke"
                    >
                      {mark && (
                        <g
                          className="text-dashboard-action-primary"
                          stroke="none"
                        >
                          <rect
                            x={-markW / 2}
                            y={number ? -36 : -26}
                            width={markW}
                            height={18}
                            rx={9}
                            fill="currentColor"
                          />
                          <text
                            y={number ? -27 : -17}
                            dominantBaseline="central"
                            fill="#FFFFFF"
                            fontSize="11"
                            fontWeight="700"
                          >
                            {mark}
                          </text>
                        </g>
                      )}
                      {detail >= 2 && (
                        <text
                          y={number ? -1 : 4}
                          dominantBaseline={number ? "text-after-edge" : "auto"}
                          fill="#0B2B4A"
                          fontSize="12.5"
                          fontWeight="600"
                        >
                          {name}
                        </text>
                      )}
                      {number && (
                        <text
                          y={detail === 1 ? 0 : 2}
                          dominantBaseline={
                            detail === 1 ? "central" : "text-before-edge"
                          }
                          fill="#516476"
                          fontSize="10.5"
                          fontWeight="500"
                        >
                          {number}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            </g>
          )}
        </svg>

        {/* Level switch and search */}
        <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex gap-2">
          {floor !== IVEY && (
            <div className="pointer-events-auto flex shrink-0 gap-1">
              {([1, 2] as Floor[]).map((n) => (
                <DashboardChip
                  key={n}
                  selected={floor === n}
                  onClick={() => {
                    setFloor(n);
                    seiLevel.current = n;
                    if (selected && selected.floor !== n) select(null);
                  }}
                >
                  Level {n}
                </DashboardChip>
              ))}
            </div>
          )}
          <div className="pointer-events-auto relative min-w-0 flex-1 md:max-w-[280px]">
            <input
              type="search"
              value={query}
              placeholder={narrow ? "Search" : "Search rooms and events"}
              aria-label="Search rooms and events"
              autoComplete="off"
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
              onKeyDown={(e) => {
                if (!hits.length) return;
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  const step = e.key === "ArrowDown" ? 1 : hits.length - 1;
                  setActive((a) => (a + step) % hits.length);
                } else if (e.key === "Enter" && hits[active]) {
                  e.preventDefault();
                  pick(hits[active]);
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="h-9 w-full rounded-dashboard-lg border border-dashboard-border-default bg-dashboard-bg-surface px-3 text-base font-medium text-dashboard-text-heavy placeholder:text-dashboard-text-placeholder focus:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary md:text-sm"
            />
            {searchOpen && query.trim() && (
              <div className="absolute right-0 top-11 max-h-72 w-[min(320px,calc(100vw-64px))] overflow-y-auto rounded-dashboard-lg border border-dashboard-border-default bg-dashboard-bg-surface shadow-dashboard-card">
                {hits.length ? (
                  hits.map((h, i) => (
                    <button
                      key={`${h.room.id}-${h.event?.title ?? ""}-${h.event?.start ?? ""}-${i}`}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(h)}
                      className={`flex w-full items-center gap-2.5 border-b border-dashboard-border-subtle px-3 py-2 text-left last:border-b-0 hover:bg-dashboard-bg-highlight ${i === active ? "bg-dashboard-bg-highlight" : ""}`}
                    >
                      <span
                        className="size-2.5 shrink-0 rounded-[3px]"
                        style={{ background: ZONES[h.room.zone].color }}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-dashboard-text-heavy">
                          {h.event ? h.event.title : h.room.name}
                        </span>
                        <span className="block text-xs text-dashboard-text-light">
                          {h.event
                            ? `${DAYS[h.event.day].slice(0, 3)} ${formatTime(h.event.start)} · ${h.room.name}${h.room.floor === IVEY ? " (Ivey)" : ""}`
                            : `${h.room.place ?? `Room ${h.room.id}`} · ${where(h.room.floor)}`}
                        </span>
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-2.5 text-sm text-dashboard-text-light">
                    Nothing matches.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Colour key */}
        <div
          className={`pointer-events-none absolute bottom-3 left-3 z-10 flex max-w-[calc(100%-72px)] flex-wrap gap-x-3 gap-y-1 rounded-dashboard-lg border border-dashboard-border-subtle bg-white/90 px-3 py-2 text-xs font-medium text-dashboard-text-light ${selected && narrow ? "hidden" : ""}`}
        >
          {zonesShown.map((z) => (
            <span key={z} className="inline-flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-[3px]"
                style={{ background: ZONES[z].color }}
              />
              {ZONES[z].label}
            </span>
          ))}
        </div>

        {/* Zoom */}
        <div
          className={`absolute bottom-3 right-3 z-10 flex flex-col overflow-hidden rounded-dashboard-lg border border-dashboard-border-default bg-dashboard-bg-surface ${selected && narrow ? "hidden" : ""}`}
        >
          {[
            { label: "Zoom in", text: "+", onClick: () => zoomCenter(1.5) },
            {
              label: "Zoom out",
              text: "−",
              onClick: () => zoomCenter(1 / 1.5),
            },
            {
              label: "Show the whole floor",
              text: "⤢",
              onClick: () => select(null),
            },
          ].map((b, i) => (
            <button
              key={b.label}
              type="button"
              aria-label={b.label}
              title={b.label}
              onClick={b.onClick}
              className={`grid size-10 place-items-center text-lg font-semibold text-dashboard-text-light hover:bg-dashboard-bg-highlight ${i ? "border-t border-dashboard-border-subtle" : ""}`}
            >
              {b.text}
            </button>
          ))}
        </div>

        {/* Room card: a bottom sheet on phones, a side panel on wider screens */}
        {selected && (
          <aside
            aria-live="polite"
            className="absolute inset-x-2 bottom-2 z-30 flex max-h-[52%] flex-col gap-4 overflow-y-auto overscroll-contain rounded-dashboard-lg border border-dashboard-border-default bg-dashboard-bg-surface p-4 shadow-dashboard-card duration-200 animate-in fade-in slide-in-from-bottom-2 md:inset-x-auto md:bottom-auto md:right-3 md:top-3 md:max-h-[calc(100%-24px)] md:w-[340px] md:p-5"
          >
            <button
              type="button"
              aria-label="Close"
              onClick={() => select(null)}
              className="absolute right-2.5 top-2.5 grid size-9 place-items-center rounded-dashboard-sm bg-dashboard-bg-nav text-dashboard-text-heavy hover:bg-dashboard-bg-navSelected"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <div className="pr-10">
              {markLabel(selected.id) && (
                <p className="mb-1.5 inline-flex rounded-full bg-dashboard-action-primary px-2 py-0.5 text-xs font-semibold text-dashboard-text-inverse">
                  {markLabel(selected.id)}
                </p>
              )}
              <h2 className="text-xl font-bold leading-tight text-dashboard-text-heavy md:text-2xl">
                {selected.name}
              </h2>
              <p className="mt-1.5 flex items-center gap-2 text-sm text-dashboard-text-light">
                <span
                  className="size-2.5 shrink-0 rounded-[3px]"
                  style={{ background: ZONES[selected.zone].color }}
                />
                {ZONES[selected.zone].label} ·{" "}
                {selected.place ?? `Room ${selected.id}`} ·{" "}
                {where(selected.floor)}
              </p>
              {selected.floor === IVEY && (
                <p className="mt-1 text-sm text-dashboard-text-light">
                  {IVEY_ADDRESS}
                </p>
              )}
            </div>
            <p className="text-sm text-dashboard-text-medium">
              {selected.about}
            </p>
            {selected.note && (
              <p className="rounded-dashboard-sm bg-[#FFF3E0] px-3 py-2.5 text-sm text-dashboard-text-warning">
                {selected.note}
              </p>
            )}
            {days.length > 0 && shownDay !== undefined && (
              <section className="flex flex-col gap-2">
                <div className="flex gap-1.5" role="group" aria-label="Day">
                  {days.map((d) => (
                    <DashboardChip
                      key={d}
                      selected={d === shownDay}
                      onClick={() => setDay(d)}
                      className="px-3 py-1.5"
                    >
                      {DAYS[d].slice(0, 3)}
                    </DashboardChip>
                  ))}
                </div>
                <ul>
                  {shownEvents.map((ev) => (
                    <li
                      key={`${ev.start}-${ev.title}`}
                      className="grid grid-cols-[104px_1fr] gap-2 py-1.5 text-sm"
                    >
                      <time className="whitespace-nowrap tabular-nums text-dashboard-text-light">
                        {formatRange(ev.start, ev.end)}
                      </time>
                      <span className="font-medium leading-snug text-dashboard-text-heavy">
                        {ev.title}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        )}
      </div>
      {marked.size > 0 && (
        <ul
          aria-label={highlightsLabel}
          className="m-0 flex list-none flex-wrap gap-2 p-0"
        >
          {[...marked].map(([id, hs]) => {
            const r = ROOM_BY_ID[id]!;
            const on = id === selectedId;
            return (
              <li key={id} data-tour={hs.find((h) => h.tour)?.tour}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    select(id);
                    // The list sits under the map; bring the map back into view
                    stageRef.current?.scrollIntoView({
                      block: "nearest",
                      behavior: reduceMotion() ? "auto" : "smooth",
                    });
                  }}
                  className={`flex min-h-11 items-center gap-2 rounded-dashboard-lg border px-3 py-1.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary ${on ? "border-dashboard-action-primary bg-dashboard-bg-highlight" : "border-dashboard-border-default bg-dashboard-bg-surface hover:bg-dashboard-bg-highlight"}`}
                >
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-[3px] border-2 border-dashboard-action-primary"
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold text-dashboard-text-heavy">
                      {hs.map((h) => h.label).join(" · ")}
                    </span>
                    <span className="block text-xs text-dashboard-text-light">
                      {`${r.place ?? `Room ${r.id}`} · ${where(r.floor)}`}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-sm font-medium text-dashboard-text-light">
        {narrow
          ? "Tap a room to see what's on there. Pinch to zoom, drag to move."
          : "Click a room to see what's on there. Pinch or ⌘/Ctrl + scroll to zoom, drag to move."}
      </p>
    </div>
  );
};

export default VenueMap;
