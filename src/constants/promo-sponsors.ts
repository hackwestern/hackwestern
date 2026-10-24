// Clickable regions over /landing/home/sponsors-hw13-v2.png (1067x795, drawn
// at 2x as 2134x1590 so it stays sharp on retina), as percentages of the
// image so they track it at any rendered size. Logos added after the image
// was flattened are overlays, on its empty lower part or below it (top >
// 100%), in the room that extraHeight reserves.
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
  // Give a changed image a new filename: Cloudflare caches www images for a
  // day, so an in-place edit shows the old picture under the new overlays.
  src: "/landing/home/sponsors-hw13-v2.png",
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
    name: "Manulife",
    href: "https://www.manulife.ca/",
    // Text baseline on Sun Life's; right edge lines up with the rows below.
    left: 56.42,
    top: 64.36,
    width: 41.8,
    height: 10.68,
    overlaySrc: "/shared/sponsors/manulife.svg",
  },
  {
    name: "StarTech.com",
    href: "https://www.startech.com/",
    // Rows below: evenly spaced from 1.97% to 98.22%, or centered. Each
    // logo is sized by eye, and each box matches its logo's aspect.
    left: 1.97,
    top: 84.28,
    width: 29.18,
    height: 10.57,
    overlaySrc: "/shared/sponsors/startech.svg",
  },
  {
    name: "CSE",
    href: "https://www.cse-cst.gc.ca/",
    left: 47.72,
    top: 83.73,
    width: 10.18,
    height: 11.66,
    overlaySrc: "/shared/sponsors/cse-trimmed.png",
  },
  {
    name: "Commure",
    href: "https://www.commure.com/",
    left: 74.46,
    top: 85.6,
    width: 23.76,
    height: 7.93,
    overlaySrc: "/shared/sponsors/commure.svg",
  },
  {
    name: "Replit",
    href: "https://replit.com/",
    // A centered pair, wordmarks on one baseline.
    left: 27.76,
    top: 101.4,
    width: 17.02,
    height: 6.51,
    overlaySrc: "/shared/sponsors/replit.png",
  },
  {
    name: "TinyFish",
    href: "https://www.tinyfish.ai/",
    left: 55.08,
    top: 102.21,
    width: 17.35,
    height: 5.19,
    overlaySrc: "/shared/sponsors/tinyfish.svg",
  },
  {
    name: "Autodesk",
    href: "https://www.autodesk.com/",
    // Wordmarks on one baseline.
    left: 1.97,
    top: 114.27,
    width: 10.84,
    height: 8.2,
    overlaySrc: "/shared/sponsors/autodesk.svg",
  },
  {
    name: "Composio",
    href: "https://composio.dev/",
    left: 27.29,
    top: 118.9,
    width: 16.74,
    height: 4.33,
    overlaySrc: "/shared/sponsors/composio.svg",
  },
  {
    name: "Accenture",
    href: "https://www.accenture.com/",
    left: 58.52,
    top: 117.68,
    width: 13.45,
    height: 4.72,
    overlaySrc: "/shared/sponsors/accenture.svg",
  },
  {
    name: "Celsius",
    href: "https://www.celsius.com/",
    left: 86.45,
    top: 118.78,
    width: 11.77,
    height: 5.44,
    overlaySrc: "/shared/sponsors/celsius.svg",
  },
];
