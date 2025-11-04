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
    x: 200,
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
    x: 530,
    y: 455,
    rotation: 0,
    href: "https://www.accenture.com/ca-en",
  },
  {
    src: `${prefix}pg.png`,
    alt: "P&G",
    width: 144,
    height: 55,
    x: 330,
    y: 480,
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
    x: 50,
    y: 480,
    rotation: 0,
    href: "https://www.meta.com",
  },
  {
    src: `${prefix}awake.png`,
    alt: "Awake Caffeinated Chocolate",
    width: 200,
    height: 200,
    x: 110,
    y: 240,
    rotation: 0,
    href: "https://www.awakechocolate.com",
  },
  {
    src: `${prefix}leuchtturm.png`,
    alt: "Leuchtturm 1917",
    width: 300,
    height: 45,
    x: 60,
    y: 370,
    rotation: 0,
    href: "https://www.leuchtturm1917.ca/",
  },
  {
    src: `${prefix}warp.png`,
    alt: "Warp",
    width: 200,
    height: 45,
    x: 450,
    y: 390,
    rotation: 0,
    href: "https://www.warp.dev/",
  },
];
