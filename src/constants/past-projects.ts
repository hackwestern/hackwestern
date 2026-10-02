export interface PastProjectAward {
  name: string;
  presentedBy: string;
}

export interface PastProject {
  name: string;
  link: string;
  createdBy: string[];
  awards: PastProjectAward[];
  edition: number;
  date: string;
  /**
   * Folder anchor (top-center of the icon) as % of the projects scene.
   * `desktop` is the 1440×1167 frame (Figma 402:6142), `mobile` the
   * 402×544 scene band of the mobile frame (Figma 585:1083).
   */
  position: {
    desktop: { x: number; y: number };
    mobile: { x: number; y: number };
  };
}

export const PAST_PROJECTS: PastProject[] = [
  {
    name: "Komo",
    link: "https://devpost.com/software/komo-4lrjdg",
    createdBy: ["Angela Cheng", "Daksh Shahani", "Zain Syed", "Karen Agustino"],
    awards: [{ name: "Third Place Overall", presentedBy: "Hack Western" }],
    edition: 12,
    date: "November 2025",
    position: {
      desktop: { x: 34.69, y: 42.42 },
      mobile: { x: 30.87, y: 14.78 },
    },
  },
  {
    name: "BravoDispatch",
    link: "https://dorahacks.io/buidl/20371",
    createdBy: [
      "Zayn Abed",
      "Maged Armanios",
      "Jinal Kasturiarachchi",
      "Jane Klavir",
    ],
    awards: [
      { name: "First Overall", presentedBy: "Hack Western" },
      {
        name: "Best AI Application Built with Cloudflare",
        presentedBy: "Cloudflare",
      },
    ],
    edition: 11,
    date: "December 2024",
    position: {
      desktop: { x: 83.37, y: 41.22 },
      mobile: { x: 71.14, y: 2.32 },
    },
  },
  {
    name: "Vril",
    link: "https://devpost.com/software/vril",
    createdBy: ["Eric Lee", "Joseph Zhang", "Isaac Nguyen", "Otis Lau"],
    awards: [
      { name: "First Place Overall", presentedBy: "Hack Western" },
      { name: "Best Use of Gemini API", presentedBy: "MLH" },
    ],
    edition: 12,
    date: "November 2025",
    position: { desktop: { x: 25.8, y: 55.7 }, mobile: { x: 88.08, y: 79.28 } },
  },
  {
    name: "FlowBoard",
    link: "https://devpost.com/software/flowboard-bdpqzg",
    createdBy: ["Austin Jian", "James Li", "Ferdinand Zhang", "Daniel Pu"],
    awards: [{ name: "Second Place Overall", presentedBy: "Hack Western" }],
    edition: 12,
    date: "November 2025",
    position: {
      desktop: { x: 32.5, y: 70.18 },
      mobile: { x: 86.12, y: 45.37 },
    },
  },
  {
    name: "Blocks",
    link: "https://dorahacks.io/buidl/20342",
    createdBy: [
      "Caroline Huang",
      "Charlene Shao",
      "Feng Zhang",
      "Ian Korovinsky",
    ],
    awards: [
      { name: "Second Overall", presentedBy: "Hack Western" },
      { name: "Best Developer Tool", presentedBy: "Warp" },
      { name: "Best Use of Starknet (2nd Place)", presentedBy: "Starknet" },
    ],
    edition: 11,
    date: "December 2024",
    position: {
      desktop: { x: 89.06, y: 69.24 },
      mobile: { x: 15.92, y: 69.26 },
    },
  },
  {
    name: "Mark3d",
    link: "https://dorahacks.io/buidl/20367",
    createdBy: ["Krish Chopra", "Janice Shi", "Fahmi Omer", "Ashley Ge"],
    awards: [{ name: "Third Overall", presentedBy: "Hack Western" }],
    edition: 11,
    date: "December 2024",
    position: {
      desktop: { x: 75.31, y: 79.01 },
      mobile: { x: 68.26, y: 26.63 },
    },
  },
  {
    name: "Manhattanhenge",
    link: "https://devpost.com/software/manhattanhenge",
    createdBy: ["Vincent Nguyen"],
    awards: [
      {
        name: "Organizer's Choice Awards: Most Creative Impact",
        presentedBy: "Hack Western",
      },
    ],
    edition: 12,
    date: "November 2025",
    position: {
      desktop: { x: 16.46, y: 81.06 },
      mobile: { x: 20.24, y: 41.18 },
    },
  },
];
