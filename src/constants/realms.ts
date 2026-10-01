import type { realm as realmEnum } from "~/server/db/schema";

export type Realm = (typeof realmEnum.enumValues)[number];

export const realms = ["safari", "mountain", "desert", "ocean"] as const;

export const realmLabel: Record<Realm, string> = {
  safari: "Safari",
  mountain: "Mountain",
  desert: "Desert",
  ocean: "Ocean",
};

/**
 * Per-realm tint tokens applied to the application background and sidebar
 * when the hacker has picked a horse. Matches the Figma realm variants
 * (Yellow=Safari, Blue=Ocean, Green=Mountain, Orange=Desert).
 */
export type RealmTint = {
  background: string;
  sidebarBg: string;
  sidebarBorder: string;
};

export const realmTint: Record<Realm, RealmTint> = {
  safari: {
    background: "/apply/realm/background-safari.png",
    sidebarBg: "rgba(254, 243, 199, 0.78)",
    sidebarBorder: "rgba(234, 179, 8, 0.35)",
  },
  ocean: {
    background: "/apply/realm/background-ocean.png",
    sidebarBg: "rgba(219, 234, 254, 0.78)",
    sidebarBorder: "rgba(37, 99, 235, 0.35)",
  },
  mountain: {
    background: "/apply/realm/background-mountain.png",
    sidebarBg: "rgba(220, 252, 231, 0.78)",
    sidebarBorder: "rgba(22, 163, 74, 0.35)",
  },
  desert: {
    background: "/apply/realm/background-desert.png",
    sidebarBg: "rgba(254, 215, 170, 0.78)",
    sidebarBorder: "rgba(234, 88, 12, 0.35)",
  },
};

/**
 * The eight horse companions the applicant can pick from during the realm
 * step. Position values are percentages of the horse-scene box so the layout
 * scales with the container. Sourced from Figma frame 219:1327.
 */
export type Horse = {
  id: number;
  realm: Realm;
  asset: string;
  /** Position of the horse's top-left corner, as a % of the scene */
  leftPct: number;
  topPct: number;
  widthPct: number;
};

const SCENE_W = 823;
const HORSE_ZONE_TOP = 208.5;
const HORSE_ZONE_H = 500;

const px = (v: number, base: number) => (v / base) * 100;

export const horses: readonly Horse[] = [
  {
    id: 1,
    realm: "desert",
    asset: "/apply/realm/desert-2.png",
    leftPct: px(6.3, SCENE_W),
    topPct: px(499.5 - HORSE_ZONE_TOP, HORSE_ZONE_H),
    widthPct: px(233, SCENE_W),
  },
  {
    id: 2,
    realm: "safari",
    asset: "/apply/realm/safari-2.png",
    leftPct: px(71.3, SCENE_W),
    topPct: px(349.5 - HORSE_ZONE_TOP, HORSE_ZONE_H),
    widthPct: px(189.8, SCENE_W),
  },
  {
    id: 3,
    realm: "desert",
    asset: "/apply/realm/desert-1.png",
    leftPct: px(244.3, SCENE_W),
    topPct: px(237.5 - HORSE_ZONE_TOP, HORSE_ZONE_H),
    widthPct: px(105, SCENE_W),
  },
  {
    id: 4,
    realm: "safari",
    asset: "/apply/realm/safari-1.png",
    leftPct: px(390.3, SCENE_W),
    topPct: px(208.5 - HORSE_ZONE_TOP, HORSE_ZONE_H),
    widthPct: px(147.2, SCENE_W),
  },
  {
    id: 5,
    realm: "mountain",
    asset: "/apply/realm/mountain-2.png",
    leftPct: px(557.3, SCENE_W),
    topPct: px(286.5 - HORSE_ZONE_TOP, HORSE_ZONE_H),
    widthPct: px(153.75, SCENE_W),
  },
  {
    id: 6,
    realm: "mountain",
    asset: "/apply/realm/mountain-1.png",
    leftPct: px(631.3, SCENE_W),
    topPct: px(405.5 - HORSE_ZONE_TOP, HORSE_ZONE_H),
    widthPct: px(185.4, SCENE_W),
  },
  {
    id: 7,
    realm: "ocean",
    asset: "/apply/realm/ocean-2.png",
    leftPct: px(490.3, SCENE_W),
    topPct: px(524.5 - HORSE_ZONE_TOP, HORSE_ZONE_H),
    widthPct: px(176.3, SCENE_W),
  },
  {
    id: 8,
    realm: "ocean",
    asset: "/apply/realm/ocean-1.png",
    leftPct: px(198.3, SCENE_W),
    topPct: px(577.5 - HORSE_ZONE_TOP, HORSE_ZONE_H),
    widthPct: px(251, SCENE_W),
  },
] as const;

export const getHorse = (id: number | null | undefined) =>
  horses.find((h) => h.id === id) ?? null;
