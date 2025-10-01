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
    x: 2788,
    y: 1200,
    width: 409,
    height: 1200,
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
