// Clickable regions over /landing/home/sponsors-hw13-v2.png (1067x795, drawn
// at 2x as 2134x1590 so it stays sharp on retina), as percentages of the
// image so they track it at any rendered size. Rows added
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
    // Text baseline on Sun Life's, right edge on the image's right margin.
    left: 56.42,
    top: 64.66,
    width: 41.8,
    height: 10.68,
    overlaySrc: "/shared/sponsors/manulife.svg",
  },
  {
    name: "StarTech.com",
    href: "https://www.startech.com/",
    // Three across, evenly spaced between the image's margins. Logos in a row
    // are sized to match text size, not box width.
    left: 1.97,
    top: 84.28,
    width: 29.18,
    height: 10.57,
    overlaySrc: "/shared/sponsors/startech.svg",
  },
  {
    name: "CSE",
    href: "https://www.cse-cst.gc.ca/",
    left: 43.31,
    top: 83.22,
    width: 11.06,
    height: 12.68,
    overlaySrc: "/shared/sponsors/cse-trimmed.png",
  },
  {
    name: "Commure",
    href: "https://www.commure.com/",
    left: 66.54,
    top: 84.28,
    width: 31.68,
    height: 10.57,
    overlaySrc: "/shared/sponsors/commure.svg",
  },
  {
    name: "Replit",
    href: "https://replit.com/",
    // A centered pair under the row above.
    left: 26.36,
    top: 102.39,
    width: 15.47,
    height: 5.92,
    overlaySrc: "/shared/sponsors/replit.png",
  },
  {
    name: "TinyFish",
    href: "https://www.tinyfish.ai/",
    left: 52.14,
    top: 102.1,
    width: 21.69,
    height: 6.49,
    overlaySrc: "/shared/sponsors/tinyfish.svg",
  },
  {
    name: "Autodesk",
    href: "https://www.autodesk.com/",
    // Five across, evenly spaced between the same margins.
    left: 1.97,
    top: 115.03,
    width: 13.9,
    height: 10.52,
    overlaySrc: "/shared/sponsors/autodesk.svg",
  },
  {
    name: "Composio",
    href: "https://composio.dev/",
    left: 21.75,
    top: 117.74,
    width: 19.69,
    height: 5.09,
    overlaySrc: "/shared/sponsors/composio.svg",
  },
  {
    name: "Accenture",
    href: "https://www.accenture.com/",
    left: 47.32,
    top: 117.58,
    width: 15.46,
    height: 5.43,
    overlaySrc: "/shared/sponsors/accenture.svg",
  },
  {
    name: "Bell",
    href: "https://www.bell.ca/",
    left: 68.66,
    top: 118.14,
    width: 5.57,
    height: 4.3,
    overlaySrc: "/shared/sponsors/bell.svg",
  },
  {
    name: "Celsius",
    href: "https://www.celsius.com/",
    left: 80.11,
    top: 116.11,
    width: 18.11,
    height: 8.36,
    overlaySrc: "/shared/sponsors/celsius.svg",
  },
];
