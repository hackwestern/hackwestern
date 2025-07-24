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
    x: 1550,
    y: 100,
    width: 1013,
  },
  [CanvasSection.Projects]: {
    x: 5600,
    y: 100,
    width: 1200,
  },
  [CanvasSection.Home]: {
    x: 4000,
    y: 1200,
    width: 409,
  },
  [CanvasSection.FAQ]: {
    x: 850,
    y: 2300,
    width: 1768,
  },
  [CanvasSection.Sponsors]: {
    x: 3584,
    y: 3300,
    width: 1240,
  },
  [CanvasSection.Team]: {
    x: 5850,
    y: 2200,
    width: 1080,
  },
};
