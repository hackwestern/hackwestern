import * as React from "react";
import { createPortal } from "react-dom";
import {
  coverRect,
  FOREGROUND_PARALLAX,
  IMAGE_HEIGHT,
  IMAGE_WIDTH,
  PIN_DATA,
  samplePath,
  type StoryPinData,
  WAYPOINTS,
  type Waypoint,
} from "./hero-path";

const STORAGE_KEY = "hw-hero-path-editor";
const BASE = JSON.stringify({ WAYPOINTS, PIN_DATA });
const REFERENCE_SCREENS = [
  { label: "1920×1080 monitor", width: 1920, height: 970 },
] as const;

type Selection = { kind: "waypoint" | "pin"; index: number } | null;

interface PathEditorProps {
  waypoints: readonly Waypoint[];
  pins: readonly StoryPinData[];
  onWaypointsChange: (waypoints: readonly Waypoint[]) => void;
  onPinsChange: (pins: readonly StoryPinData[]) => void;
}

const round = (value: number) => Math.round(value * 1000) / 1000;

function formatCode(
  waypoints: readonly Waypoint[],
  pins: readonly StoryPinData[],
) {
  const waypointLines = waypoints
    .map(
      (point) =>
        `  { x: ${round(point.x)}, y: ${round(point.y)}, w: ${Math.round(point.w)} },`,
    )
    .join("\n");
  const pinLines = pins
    .map((pin) => {
      const fields = [
        `x: ${round(pin.x)},`,
        `y: ${round(pin.y)},`,
        `size: ${Math.round(pin.size)},`,
        ...(pin.anchor ? [`anchor: "${pin.anchor}",`] : []),
        `title: ${JSON.stringify(pin.title)},`,
        `body: ${JSON.stringify(pin.body)},`,
        `windowWidth: ${pin.windowWidth},`,
      ];
      return `  {\n${fields.map((field) => `    ${field}`).join("\n")}\n  },`;
    })
    .join("\n");

  return `export const WAYPOINTS: readonly Waypoint[] = [\n${waypointLines}\n];\n\nexport const PIN_DATA: readonly StoryPinData[] = [\n${pinLines}\n];\n`;
}

function finalFrameTop(width: number, viewportHeight: number) {
  const sceneHeight = Math.max(
    viewportHeight,
    (width * IMAGE_HEIGHT) / IMAGE_WIDTH,
  );
  const rect = coverRect(width, sceneHeight);
  const top = sceneHeight - viewportHeight - FOREGROUND_PARALLAX;
  return (top - rect.top) / rect.height;
}

export default function PathEditor({
  waypoints,
  pins,
  onWaypointsChange,
  onPinsChange,
}: PathEditorProps) {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const dragRef = React.useRef<Selection>(null);
  const [selected, setSelected] = React.useState<Selection>(null);
  const [showHandles, setShowHandles] = React.useState(true);
  const [copied, setCopied] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const [frameLines, setFrameLines] = React.useState<
    { label: string; y: number }[]
  >([]);

  const commit = (next: {
    waypoints?: readonly Waypoint[];
    pins?: readonly StoryPinData[];
  }) => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        base: BASE,
        waypoints: next.waypoints ?? waypoints,
        pins: next.pins ?? pins,
      }),
    );
    if (next.waypoints) onWaypointsChange(next.waypoints);
    if (next.pins) onPinsChange(next.pins);
  };

  React.useEffect(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem(STORAGE_KEY) ?? "null",
      ) as {
        base: string;
        waypoints: Waypoint[];
        pins: StoryPinData[];
      } | null;
      if (stored?.base === BASE) {
        onWaypointsChange(stored.waypoints);
        onPinsChange(stored.pins);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [onWaypointsChange, onPinsChange]);

  React.useEffect(() => {
    const measure = () => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = coverRect(svg.clientWidth, svg.clientHeight);
      const top = svg.clientHeight - window.innerHeight - FOREGROUND_PARALLAX;
      setFrameLines([
        {
          label: `This screen (${window.innerWidth}×${window.innerHeight})`,
          y: (top - rect.top) / rect.height,
        },
        ...REFERENCE_SCREENS.map((screen) => ({
          label: screen.label,
          y: finalFrameTop(screen.width, screen.height),
        })),
      ]);
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const toImage = (event: { clientX: number; clientY: number }) => {
    const matrix = svgRef.current?.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix.inverse(),
    );
    return { x: point.x / IMAGE_WIDTH, y: point.y / IMAGE_HEIGHT };
  };

  const move = (target: NonNullable<Selection>, x: number, y: number) => {
    if (target.kind === "waypoint") {
      commit({
        waypoints: waypoints.map((point, index) =>
          index === target.index
            ? { ...point, x: round(x), y: round(y) }
            : point,
        ),
      });
    } else {
      commit({
        pins: pins.map((pin, index) =>
          index === target.index ? { ...pin, x: round(x), y: round(y) } : pin,
        ),
      });
    }
  };

  const resize = (target: NonNullable<Selection>, factor: number) => {
    if (target.kind === "waypoint") {
      commit({
        waypoints: waypoints.map((point, index) =>
          index === target.index
            ? { ...point, w: Math.max(4, Math.round(point.w * factor)) }
            : point,
        ),
      });
    } else {
      commit({
        pins: pins.map((pin, index) =>
          index === target.index
            ? { ...pin, size: Math.max(12, Math.round(pin.size * factor)) }
            : pin,
        ),
      });
    }
  };

  const selectedPosition = selected
    ? selected.kind === "waypoint"
      ? waypoints[selected.index]
      : pins[selected.index]
    : undefined;

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!selected || !selectedPosition) return;
      if ((event.target as HTMLElement).closest("input, textarea")) return;

      const step = event.shiftKey ? 0.01 : 0.002;
      const nudges: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const nudge = nudges[event.key];

      if (nudge) {
        move(
          selected,
          selectedPosition.x + nudge[0],
          selectedPosition.y + nudge[1],
        );
      } else if (event.key === "[" || event.key === "]") {
        resize(selected, event.key === "]" ? 1.1 : 1 / 1.1);
      } else if (
        (event.key === "Backspace" || event.key === "Delete") &&
        selected.kind === "waypoint" &&
        waypoints.length > 2
      ) {
        commit({
          waypoints: waypoints.filter((_, index) => index !== selected.index),
        });
        setSelected(null);
      } else if (event.key === "Escape") {
        setSelected(null);
      } else {
        return;
      }
      event.preventDefault();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const startDrag = (
    event: React.PointerEvent,
    target: NonNullable<Selection>,
  ) => {
    event.stopPropagation();
    setSelected(target);
    dragRef.current = target;
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const target = dragRef.current;
    if (!target) return;
    const point = toImage(event);
    if (point) move(target, point.x, point.y);
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const insertWaypoint = (event: React.MouseEvent) => {
    const point = toImage(event);
    if (!point) return;

    let segment = 0;
    let closest = Infinity;
    for (let index = 0; index < waypoints.length - 1; index++) {
      const from = waypoints[index]!;
      const to = waypoints[index + 1]!;
      const distance =
        ((from.x + to.x) / 2 - point.x) ** 2 +
        ((from.y + to.y) / 2 - point.y) ** 2;
      if (distance < closest) {
        closest = distance;
        segment = index;
      }
    }

    const from = waypoints[segment]!;
    const to = waypoints[segment + 1] ?? from;
    const next = [...waypoints];
    next.splice(segment + 1, 0, {
      x: round(point.x),
      y: round(point.y),
      w: Math.round((from.w + to.w) / 2),
    });
    commit({ waypoints: next });
    setSelected({ kind: "waypoint", index: segment + 1 });
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(formatCode(waypoints, pins));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const reset = () => {
    localStorage.removeItem(STORAGE_KEY);
    onWaypointsChange(WAYPOINTS);
    onPinsChange(PIN_DATA);
    setSelected(null);
  };

  const jumpToFinalFrame = () => {
    const hero = document.getElementById("hero");
    if (!hero) return;
    window.scrollTo({
      top: hero.offsetTop + hero.offsetHeight - window.innerHeight,
      behavior: "smooth",
    });
  };

  const centerline = Array.from({ length: 241 }, (_, step) => {
    const point = samplePath(waypoints, step / 240);
    return `${point.x * IMAGE_WIDTH},${point.y * IMAGE_HEIGHT}`;
  }).join(" ");

  const gridLines = Array.from({ length: 21 }, (_, index) => index / 20);

  return (
    <>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${IMAGE_WIDTH} ${IMAGE_HEIGHT}`}
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full touch-none select-none"
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerDown={() => setSelected(null)}
        onDoubleClick={insertWaypoint}
      >
        {showHandles && (
          <>
            <g className="pointer-events-none">
              {gridLines.map((value) => (
                <React.Fragment key={value}>
                  <line
                    x1={value * IMAGE_WIDTH}
                    x2={value * IMAGE_WIDTH}
                    y1={0}
                    y2={IMAGE_HEIGHT}
                    stroke="rgba(255,80,80,0.35)"
                    strokeWidth={
                      value * 10 === Math.round(value * 10) ? 1 : 0.5
                    }
                    vectorEffect="non-scaling-stroke"
                  />
                  <line
                    x1={0}
                    x2={IMAGE_WIDTH}
                    y1={value * IMAGE_HEIGHT}
                    y2={value * IMAGE_HEIGHT}
                    stroke="rgba(255,80,80,0.35)"
                    strokeWidth={
                      value * 10 === Math.round(value * 10) ? 1 : 0.5
                    }
                    vectorEffect="non-scaling-stroke"
                  />
                  {value * 10 === Math.round(value * 10) && (
                    <>
                      <text
                        x={value * IMAGE_WIDTH + 6}
                        y={IMAGE_HEIGHT * 0.5}
                        fill="rgba(255,120,120,0.9)"
                        fontSize={22}
                        fontFamily="monospace"
                      >
                        x {value.toFixed(1)}
                      </text>
                      <text
                        x={8}
                        y={value * IMAGE_HEIGHT - 6}
                        fill="rgba(255,120,120,0.9)"
                        fontSize={22}
                        fontFamily="monospace"
                      >
                        y {value.toFixed(1)}
                      </text>
                    </>
                  )}
                </React.Fragment>
              ))}

              {frameLines.map((line, index) => (
                <g key={line.label}>
                  <line
                    x1={0}
                    x2={IMAGE_WIDTH}
                    y1={line.y * IMAGE_HEIGHT}
                    y2={line.y * IMAGE_HEIGHT}
                    stroke={index === 0 ? "#facc15" : "#38bdf8"}
                    strokeWidth={2}
                    strokeDasharray="10 6"
                    vectorEffect="non-scaling-stroke"
                  />
                  <text
                    x={IMAGE_WIDTH - 12}
                    y={line.y * IMAGE_HEIGHT - 10}
                    textAnchor="end"
                    fill={index === 0 ? "#facc15" : "#38bdf8"}
                    fontSize={26}
                    fontFamily="monospace"
                  >
                    {`top of final frame: ${line.label}`}
                  </text>
                </g>
              ))}

              <polyline
                points={centerline}
                fill="none"
                stroke="rgba(255,255,255,0.8)"
                strokeWidth={1.5}
                strokeDasharray="6 4"
                vectorEffect="non-scaling-stroke"
              />
              {waypoints.map((point, index) => (
                <circle
                  key={index}
                  cx={point.x * IMAGE_WIDTH}
                  cy={point.y * IMAGE_HEIGHT}
                  r={point.w / 2}
                  fill="none"
                  stroke="rgba(255,255,255,0.35)"
                  strokeDasharray="4 4"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>

            {waypoints.map((point, index) => {
              const isSelected =
                selected?.kind === "waypoint" && selected.index === index;
              return (
                <g
                  key={index}
                  className="cursor-grab active:cursor-grabbing"
                  onPointerDown={(event) =>
                    startDrag(event, { kind: "waypoint", index })
                  }
                  onDoubleClick={(event) => event.stopPropagation()}
                >
                  <circle
                    cx={point.x * IMAGE_WIDTH}
                    cy={point.y * IMAGE_HEIGHT}
                    r={18}
                    fill={isSelected ? "#facc15" : "white"}
                    stroke="#111"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                  />
                  <text
                    x={point.x * IMAGE_WIDTH}
                    y={point.y * IMAGE_HEIGHT + 7}
                    textAnchor="middle"
                    fontSize={20}
                    fontFamily="monospace"
                    fill="#111"
                    className="pointer-events-none"
                  >
                    {index + 1}
                  </text>
                </g>
              );
            })}

            {pins.map((pin, index) => {
              const isSelected =
                selected?.kind === "pin" && selected.index === index;
              return (
                <g
                  key={pin.title}
                  className="cursor-grab active:cursor-grabbing"
                  onPointerDown={(event) =>
                    startDrag(event, { kind: "pin", index })
                  }
                  onDoubleClick={(event) => event.stopPropagation()}
                >
                  <rect
                    x={pin.x * IMAGE_WIDTH - 16}
                    y={pin.y * IMAGE_HEIGHT - 16}
                    width={32}
                    height={32}
                    transform={`rotate(45 ${pin.x * IMAGE_WIDTH} ${pin.y * IMAGE_HEIGHT})`}
                    fill={isSelected ? "#facc15" : "#ef4444"}
                    stroke="white"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                  />
                  <text
                    x={pin.x * IMAGE_WIDTH + 28}
                    y={pin.y * IMAGE_HEIGHT + 42}
                    fontSize={24}
                    fontFamily="monospace"
                    fill="white"
                    stroke="#111"
                    strokeWidth={4}
                    paintOrder="stroke"
                    className="pointer-events-none"
                  >
                    {pin.title}
                  </text>
                </g>
              );
            })}
          </>
        )}
      </svg>

      {createPortal(
        <div className="fixed bottom-4 right-4 z-[1000] w-72 rounded-lg bg-black/80 p-4 font-figtree text-xs leading-relaxed text-white shadow-xl backdrop-blur">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Path editor</p>
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              className="rounded bg-white/15 px-2 py-0.5"
            >
              {collapsed ? "Show" : "Hide"}
            </button>
          </div>
          <div className={collapsed ? "hidden" : "mt-2"}>
            <ul className="mb-3 list-disc space-y-0.5 pl-4 text-white/80">
              <li>Drag white dots (path) or red diamonds (pins)</li>
              <li>Double-click empty space to add a path point</li>
              <li>
                <kbd>[</kbd> / <kbd>]</kbd> shrink / grow the selected point or
                pin
              </li>
              <li>Arrow keys nudge (hold Shift for more)</li>
              <li>Delete removes the selected path point</li>
              <li>
                Keep pins below the dashed lines so they show on every screen
              </li>
            </ul>
            <p className="mb-3 min-h-[1.25rem] font-mono text-[11px] text-yellow-300">
              {selected && selectedPosition
                ? `${selected.kind === "waypoint" ? `Point ${selected.index + 1}` : "Pin"}  x ${round(selectedPosition.x)}  y ${round(selectedPosition.y)}  ${
                    "w" in selectedPosition
                      ? `w ${Math.round(selectedPosition.w)}`
                      : `size ${Math.round(selectedPosition.size)}`
                  }`
                : "Nothing selected"}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={copyCode}
                className="col-span-2 rounded bg-white px-2 py-1.5 font-semibold text-black"
              >
                {copied ? "Copied!" : "Copy code for hero-path.ts"}
              </button>
              <button
                type="button"
                onClick={jumpToFinalFrame}
                className="rounded bg-white/15 px-2 py-1.5"
              >
                Final frame
              </button>
              <button
                type="button"
                onClick={() => setShowHandles((value) => !value)}
                className="rounded bg-white/15 px-2 py-1.5"
              >
                {showHandles ? "Hide handles" : "Show handles"}
              </button>
              <button
                type="button"
                onClick={reset}
                className="col-span-2 rounded bg-white/15 px-2 py-1.5"
              >
                Reset to code
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
