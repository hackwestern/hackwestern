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
    x: 5100,
    y: 550,
  },
  [CanvasSection.Home]: {
    x: 3300,
    y: 2200,
  },
  [CanvasSection.FAQ]: {
    x: 350,
    y: 3000,
  },
  [CanvasSection.Sponsors]: {
    x: 3350,
    y: 4100,
  },
  [CanvasSection.Team]: {
    x: 5600,
    y: 3000,
  },
};
