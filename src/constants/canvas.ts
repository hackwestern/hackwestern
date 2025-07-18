export enum CanvasSection {
  About = "about",
  Projects = "projects",
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
  [CanvasSection.FAQ]: {
    x: 550,
    y: 2700,
  },
  [CanvasSection.Sponsors]: {
    x: 2750,
    y: 3500,
  },
  [CanvasSection.Team]: {
    x: 5100,
    y: 2700,
  },
};
