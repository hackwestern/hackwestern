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
    x: 180,
    y: 28,
    rotation: 0,
    href: "https://www.scotiabank.com",
  },
  {
    src: `${prefix}canadalife.png`,
    alt: "Canada Life",
    width: 312,
    height: 108,
    x: 60,
    y: 170,
    rotation: 2,
    href: "https://www.canadalife.com",
  },
  {
    src: `${prefix}accenture.png`,
    alt: "Accenture",
    width: 270,
    height: 86,
    x: 525,
    y: 143,
    rotation: 1,
    href: "https://www.accenture.com/ca-en",
  },
  {
    src: `${prefix}pg.png`,
    alt: "P&G",
    width: 148,
    height: 62,
    x: 100,
    y: 380,
    rotation: -4.6,
    href: "https://www.pg.ca/en-ca/",
  },
  {
    src: `${prefix}sunlife.png`,
    alt: "Sun Life",
    width: 295,
    height: 72,
    x: 505,
    y: 295,
    rotation: -3.5,
    href: "https://www.sunlife.ca",
  },
  {
    src: `${prefix}manulife.png`,
    alt: "Manulife",
    width: 398,
    height: 82,
    x: 280,
    y: 450,
    rotation: 0,
    href: "https://www.manulife.ca",
  },
];
