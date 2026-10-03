// Clickable regions over /landing/home/sponsors-hw13.png (1067x795), as
// percentages of the image so they track it at any rendered size.
export type PromoSponsorLink = {
  name: string;
  href: string;
  left: number;
  top: number;
  width: number;
  height: number;
  // Logos missing from the flattened image are drawn on top of it.
  overlaySrc?: string;
};

export const PROMO_SPONSORS_IMAGE = {
  src: "/landing/home/sponsors-hw13.png",
  width: 1067,
  height: 795,
};

export const PROMO_SPONSOR_LINKS: readonly PromoSponsorLink[] = [
  {
    name: "Scotiabank",
    href: "https://www.scotiabank.com/ca/en/personal.html",
    left: 0,
    top: 0,
    width: 98,
    height: 20,
  },
  {
    name: "Canada Life",
    href: "https://www.canadalife.com/",
    left: 1,
    top: 31,
    width: 40,
    height: 20,
  },
  {
    name: "QNX",
    href: "https://qnx.software/en",
    left: 50,
    top: 32,
    width: 30,
    height: 17,
  },
  {
    name: "Sun Life",
    href: "https://www.sunlife.ca/en/",
    left: 1,
    top: 59,
    width: 49,
    height: 17,
  },
  {
    name: "Commure",
    href: "https://www.commure.com/",
    left: 57,
    top: 61,
    width: 43,
    height: 15,
  },
  {
    name: "Autodesk",
    href: "https://www.autodesk.com/",
    left: 1,
    top: 86.54,
    width: 16.59,
    height: 12.58,
    overlaySrc: "/shared/sponsors/autodesk.svg",
  },
];
