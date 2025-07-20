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
  },
  [CanvasSection.Projects]: {
    x: 6100,
    y: 550,
  },
  [CanvasSection.Home]: {
    x: 4300,
    y: 2200,
  },
  [CanvasSection.FAQ]: {
    x: 1350,
    y: 3000,
  },
  [CanvasSection.Sponsors]: {
    x: 4350,
    y: 4100,
  },
  [CanvasSection.Team]: {
    x: 6400,
    y: 3000,
  },
};
