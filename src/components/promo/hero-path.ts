export const IMAGE_WIDTH = 2880;
export const IMAGE_HEIGHT = 2550;
export const FOREGROUND_PARALLAX = 56;

export interface Waypoint {
  x: number;
  y: number;
  w: number;
}

export interface StoryPinData {
  x: number;
  y: number;
  size: number;
  title: string;
  body: string;
  windowWidth: number;
  anchor?: "left" | "center" | "right";
}

// Coordinates are fractions of the mountain artwork (0,0 = top-left,
// 1,1 = bottom-right), so they stay glued to the terrain at any screen size.
// `w` (path width) and `size` (pin width) are in artwork pixels.
// Redraw these with the in-browser editor: open /?pathEditor in dev.
// ---- path-editor:start ----
export const WAYPOINTS: readonly Waypoint[] = [
  { x: 1, y: 0.99, w: 360 },
  { x: 0.85, y: 0.93, w: 280 },
  { x: 0.6, y: 0.87, w: 210 },
  { x: 0.35, y: 0.83, w: 150 },
  { x: 0.159, y: 0.78, w: 100 },
  { x: 0.013, y: 0.751, w: 70 },
  { x: 0.211, y: 0.74, w: 52 },
  { x: 0.382, y: 0.741, w: 38 },
  { x: 0.54, y: 0.699, w: 24 },
  { x: 0.62, y: 0.653, w: 8 },
];

export const PIN_DATA: readonly StoryPinData[] = [
  {
    x: 0.85,
    y: 0.93,
    size: 120,
    title: "Create. Collaborate. Innovate.",
    body: "Collaborate in teams of up to four to create tech projects, while participating in workshops, learning from mentors, competing for prizes, and meeting like-minded hackers.",
    windowWidth: 500,
  },
  {
    x: 0.039,
    y: 0.751,
    size: 52,
    anchor: "left",
    title: "It's on us",
    body: "We cover food, travel, and lodging so you can focus on bringing your ideas to life!",
    windowWidth: 400,
  },
  {
    x: 0.601,
    y: 0.664,
    size: 38,
    title: "Build something unexpected",
    body: "Spend the weekend exploring an idea, learning new tools, and sharing what you made.",
    windowWidth: 320,
  },
];
// ---- path-editor:end ----

export interface CoverRect {
  left: number;
  top: number;
  width: number;
  height: number;
  scale: number;
}

// Mirrors `object-fit: cover` + `object-position: bottom` for the artwork:
// extra height is cropped from the top, keeping the path's valley in view.
export function coverRect(sceneWidth: number, sceneHeight: number): CoverRect {
  const scale = Math.max(sceneWidth / IMAGE_WIDTH, sceneHeight / IMAGE_HEIGHT);
  const width = IMAGE_WIDTH * scale;
  const height = IMAGE_HEIGHT * scale;

  return {
    left: (sceneWidth - width) / 2,
    top: sceneHeight - height,
    width,
    height,
    scale,
  };
}

function catmullRom(
  before: number,
  from: number,
  to: number,
  after: number,
  t: number,
) {
  return (
    0.5 *
    (2 * from +
      (-before + to) * t +
      (2 * before - 5 * from + 4 * to - after) * t ** 2 +
      (-before + 3 * from - 3 * to + after) * t ** 3)
  );
}

export function samplePath(
  waypoints: readonly Waypoint[],
  t: number,
): Waypoint {
  const last = waypoints.length - 1;
  if (last < 1) return waypoints[0] ?? { x: 0, y: 0, w: 0 };

  const segment = Math.min(last - 1, Math.floor(t * last));
  const local = t * last - segment;
  const before = waypoints[Math.max(0, segment - 1)]!;
  const from = waypoints[segment]!;
  const to = waypoints[segment + 1]!;
  const after = waypoints[Math.min(last, segment + 2)]!;

  return {
    x: catmullRom(before.x, from.x, to.x, after.x, local),
    y: catmullRom(before.y, from.y, to.y, after.y, local),
    w: Math.max(2, catmullRom(before.w, from.w, to.w, after.w, local)),
  };
}

export function closestProgress(
  waypoints: readonly Waypoint[],
  x: number,
  y: number,
) {
  let closest = Infinity;
  let progress = 0;

  for (let step = 0; step <= 300; step++) {
    const t = step / 300;
    const point = samplePath(waypoints, t);
    const distance = (point.x - x) ** 2 + (point.y - y) ** 2;
    if (distance < closest) {
      closest = distance;
      progress = t;
    }
  }

  return progress;
}
