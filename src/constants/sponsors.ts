export interface SponsorLogoProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  x: number;
  y: number;
  rotation: number;
  href: string;
}

const prefix = "/sponsors/";

export const SPONSORS: readonly SponsorLogoProps[] = [
  {
    src: `${prefix}scotiabank.png`,
    alt: "Scotiabank",
    width: 448,
    height: 87,
    x: 260,
    y: 28,
    rotation: 0,
    href: "https://www.scotiabank.com",
  },
  {
    src: `${prefix}canadalife.png`,
    alt: "Canada Life",
    width: 312,
    height: 108,
    x: 520,
    y: 260,
    rotation: 0,
    href: "https://www.canadalife.com",
  },
  {
    src: `${prefix}accenture.png`,
    alt: "Accenture",
    width: 290,
    height: 86,
    x: 515,
    y: 455,
    rotation: 0,
    href: "https://www.accenture.com/ca-en",
  },
  {
    src: `${prefix}pg.png`,
    alt: "P&G",
    width: 168,
    height: 62,
    x: 340,
    y: 410,
    rotation: 0,
    href: "https://www.pg.ca/en-ca/",
  },
  {
    src: `${prefix}sunlife.png`,
    alt: "Sun Life",
    width: 345,
    height: 72,
    x: 475,
    y: 140,
    rotation: 0.4,
    href: "https://www.sunlife.ca",
  },
  {
    src: `${prefix}manulife.png`,
    alt: "Manulife",
    width: 398,
    height: 82,
    x: 25,
    y: 150,
    rotation: -0.2,
    href: "https://www.manulife.ca",
  },
  {
    src: `${prefix}meta.png`,
    alt: "Meta",
    width: 230,
    height: 160,
    x: 67,
    y: 450,
    rotation: 0,
    href: "https://www.meta.com",
  },
  {
    src: `${prefix}awake.png`,
    alt: "Awake Caffeinated Chocolate",
    width: 200,
    height: 200,
    x: 100,
    y: 280,
    rotation: 0,
    href: "https://www.awakechocolate.com",
  },
];
