export enum CanvasSection {
  About = "about",
  Projects = "projects",
  Home = "home",
  FAQ = "faq",
  Sponsors = "sponsors",
  Team = "team",
}

export const coordinates = {
  [CanvasSection.About]: {
    x: 2350,
    y: 550,
    width: 1013,
  },
  [CanvasSection.Projects]: {
    x: 6550,
    y: 550,
    width: 1200,
  },
  [CanvasSection.Home]: {
    x: 3850,
    y: 1800,
    width: undefined, // home is screen width
  },
  [CanvasSection.FAQ]: {
    x: 1800,
    y: 3000,
    width: 1768,
  },
  [CanvasSection.Sponsors]: {
    x: 4800,
    y: 4100,
    width: 1240,
  },
  [CanvasSection.Team]: {
    x: 6850,
    y: 3000,
    width: 1080,
  },
};
