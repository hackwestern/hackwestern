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
    x: 1550,
    y: 400,
    width: 1013,
    height: 800,
  },
  [CanvasSection.Projects]: {
    x: 5600,
    y: 400,
    width: 1200,
    height: 800,
  },
  [CanvasSection.Home]: {
    x: 4000,
    y: 1500,
    width: 409,
    height: 1200,
  },
  [CanvasSection.FAQ]: {
    x: 850,
    y: 2600,
    width: 1768,
    height: 917,
  },
  [CanvasSection.Sponsors]: {
    x: 3584,
    y: 3600,
    width: 1240,
    height: 900,
  },
  [CanvasSection.Team]: {
    x: 5850,
    y: 2500,
    width: 1080,
    height: 917,
  },
};
