export enum CanvasSection {
  About = "about",
  Projects = "projects",
  Home = "home",
  FAQ = "faq",
  Sponsors = "sponsors",
  Team = "team",
}

export interface SectionCoordinates {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const coordinates: Record<CanvasSection, SectionCoordinates> = {
  [CanvasSection.About]: {
    x: 1400,
    y: 400,
    width: 1013,
    height: 800,
  },
  [CanvasSection.Projects]: {
    x: 3663,
    y: 400,
    width: 1200,
    height: 895,
  },
  [CanvasSection.Home]: {
    x: 2867,
    y: 1200,
    width: 264,
    height: 800,
  },
  [CanvasSection.Sponsors]: {
    x: 760,
    y: 1700,
    width: 1240,
    height: 900,
  },
  [CanvasSection.FAQ]: {
    x: 2070,
    y: 2600,
    width: 1768,
    height: 917,
  },

  [CanvasSection.Team]: {
    x: 4050,
    y: 1660,
    width: 1080,
    height: 917,
  },
};

// Reverse lookup using strict reference or value match.
export const coordinatesToSection = (
  coords: SectionCoordinates | undefined,
): CanvasSection | null => {
  if (!coords) return null;
  // Try identity first
  for (const key of Object.keys(coordinates) as CanvasSection[]) {
    if (coordinates[key] === coords) return key;
  }
  // Fallback value match (in case a cloned object is passed)
  for (const key of Object.keys(coordinates) as CanvasSection[]) {
    const c = coordinates[key];
    if (
      c.x === coords.x &&
      c.y === coords.y &&
      c.width === coords.width &&
      c.height === coords.height
    ) {
      return key;
    }
  }
  return null;
};
