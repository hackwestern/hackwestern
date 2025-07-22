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
    x: 1900,
    y: 550,
    width: 1013,
  },
  [CanvasSection.Projects]: {
    x: 6100,
    y: 550,
    width: 1200,
  },
  [CanvasSection.Home]: {
    x: 3400,
    y: 1800,
    width: undefined, // home is screen width
  },
  [CanvasSection.FAQ]: {
    x: 1350,
    y: 3000,
    width: 1768,
  },
  [CanvasSection.Sponsors]: {
    x: 4350,
    y: 4100,
    width: 1240,
  },
  [CanvasSection.Team]: {
    x: 6400,
    y: 3000,
    width: 1080,
  },
};
