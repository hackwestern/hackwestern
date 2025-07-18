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
    x: 1100,
    y: 550,
  },
  [CanvasSection.Projects]: {
    x: 4600,
    y: 550,
  },
  [CanvasSection.Home]: {
    x: 3000,
    y: 2000,
  },
  [CanvasSection.FAQ]: {
    x: 550,
    y: 2700,
  },
  [CanvasSection.Sponsors]: {
    x: 3050,
    y: 3500,
  },
  [CanvasSection.Team]: {
    x: 5100,
    y: 2700,
  },
};
