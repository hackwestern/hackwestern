// Clickable regions over /landing/home/sponsors-hw13.png (1067x795, drawn at
// 2x as 2134x1590 so it stays sharp on retina), as percentages of the image so
// they track it at any rendered size. Rows added
// after the image was flattened sit below it (top > 100%), in the room that
// extraHeight reserves.
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
  // Image pixels of room below the image for the overlay-only rows.
  extraHeight: 214,
};

export const PROMO_SPONSOR_LINKS: readonly PromoSponsorLink[] = [
  {
    name: "Scotiabank",
    href: "https://www.scotiabank.com/ca/en/personal.html",
    // The logo touches the top of the image (y 0.25%–18.36%), so the box
    // starts above it to leave the same 13px gap on every side.
    left: 0.56,
    top: -1.39,
    width: 97.85,
    height: 21.39,
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
    name: "Manulife",
    href: "https://www.manulife.ca/",
    left: 1.97,
    top: 86.96,
    width: 44.05,
    height: 11.26,
    overlaySrc: "/shared/sponsors/manulife.svg",
  },
  {
    name: "StarTech.com",
    href: "https://www.startech.com/",
    left: 57.83,
    top: 85.91,
    width: 36.83,
    height: 13.33,
    overlaySrc: "/shared/sponsors/startech.svg",
  },
  {
    name: "CSE",
    href: "https://www.cse-cst.gc.ca/",
    left: 1.97,
    top: 109.69,
    width: 14.25,
    height: 16.35,
    overlaySrc: "/shared/sponsors/cse-trimmed.png",
  },
  {
    name: "Autodesk",
    href: "https://www.autodesk.com/",
    left: 57.83,
    top: 111.57,
    width: 16.59,
    height: 12.58,
    overlaySrc: "/shared/sponsors/autodesk.svg",
  },
  {
    name: "Replit",
    href: "https://replit.com/",
    left: 80,
    top: 114.39,
    width: 18,
    height: 6.94,
    overlaySrc: "/shared/sponsors/replit.png",
  },
];
