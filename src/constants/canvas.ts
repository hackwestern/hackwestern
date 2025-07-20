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
    x: 900,
    y: 550,
  },
  [CanvasSection.Projects]: {
    x: 4400,
    y: 550,
  },
  [CanvasSection.Home]: {
    x: 2800,
    y: 2000,
  },
  [CanvasSection.FAQ]: {
    x: 350,
    y: 2700,
  },
  [CanvasSection.Sponsors]: {
    x: 2850,
    y: 3500,
  },
  [CanvasSection.Team]: {
    x: 4900,
    y: 2700,
  },
};
