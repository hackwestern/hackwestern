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
  sidebarItemHover: string;
  sidebarItemActive: string;
  /** Solid, readable realm color used for text + accents inside tinted forms. */
  accent: string;
  /** Softer realm color used for secondary / muted copy inside tinted forms. */
  accentMuted: string;
  /**
   * Opaque sidebar color. The application window and its form fields mix in
   * a little of it (see `--realm-tint` in globals.css).
   */
  tintColor: string;
};

export const realmTint: Record<Realm, RealmTint> = {
  safari: {
    background: "/apply/realm/background-safari.png",
    sidebarBg: "rgba(254, 243, 199, 0.78)",
    sidebarBorder: "rgba(234, 179, 8, 0.35)",
    sidebarItemHover: "rgba(234, 179, 8, 0.22)",
    sidebarItemActive: "rgba(234, 179, 8, 0.45)",
    accent: "#854d0e",
    accentMuted: "#a16207",
    tintColor: "rgb(254, 243, 199)",
  },
  ocean: {
    background: "/apply/realm/background-ocean.png",
    sidebarBg: "rgba(219, 234, 254, 0.78)",
    sidebarBorder: "rgba(37, 99, 235, 0.35)",
    sidebarItemHover: "rgba(37, 99, 235, 0.22)",
    sidebarItemActive: "rgba(37, 99, 235, 0.4)",
    accent: "#1e3a8a",
    accentMuted: "#1d4ed8",
    tintColor: "rgb(219, 234, 254)",
  },
  mountain: {
    background: "/apply/realm/background-mountain.png",
    sidebarBg: "rgba(220, 252, 231, 0.78)",
    sidebarBorder: "rgba(22, 163, 74, 0.35)",
    sidebarItemHover: "rgba(22, 163, 74, 0.22)",
    sidebarItemActive: "rgba(22, 163, 74, 0.4)",
    accent: "#14532d",
    accentMuted: "#166534",
    tintColor: "rgb(220, 252, 231)",
  },
  desert: {
    background: "/apply/realm/background-desert.png",
    sidebarBg: "rgba(254, 215, 170, 0.78)",
    sidebarBorder: "rgba(234, 88, 12, 0.35)",
    sidebarItemHover: "rgba(234, 88, 12, 0.22)",
    sidebarItemActive: "rgba(234, 88, 12, 0.4)",
    accent: "#7c2d12",
    accentMuted: "#9a3412",
    tintColor: "rgb(254, 215, 170)",
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
  /** Mouth position inside the horse PNG, as a % of the image's bounding box. */
  mouthXPct: number;
  mouthYPct: number;
  /**
   * Which side of the horse the speech bubble should emerge from. Horses that
   * face right get a right-side bubble; left-facing horses get a left-side one.
   */
  bubbleSide: "left" | "right";
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
    mouthXPct: 42,
    mouthYPct: 29,
    bubbleSide: "right",
  },
  {
    id: 2,
    realm: "safari",
    asset: "/apply/realm/safari-2.png",
    leftPct: px(71.3, SCENE_W),
    topPct: px(349.5 - HORSE_ZONE_TOP, HORSE_ZONE_H),
    widthPct: px(189.8, SCENE_W),
    mouthXPct: 86,
    mouthYPct: 78,
    bubbleSide: "right",
  },
  {
    id: 3,
    realm: "desert",
    asset: "/apply/realm/desert-1.png",
    leftPct: px(244.3, SCENE_W),
    topPct: px(237.5 - HORSE_ZONE_TOP, HORSE_ZONE_H),
    widthPct: px(105, SCENE_W),
    mouthXPct: 14,
    mouthYPct: 28,
    bubbleSide: "left",
  },
  {
    id: 4,
    realm: "safari",
    asset: "/apply/realm/safari-1.png",
    leftPct: px(390.3, SCENE_W),
    topPct: px(208.5 - HORSE_ZONE_TOP, HORSE_ZONE_H),
    widthPct: px(147.2, SCENE_W),
    mouthXPct: 92,
    mouthYPct: 36,
    bubbleSide: "right",
  },
  {
    id: 5,
    realm: "mountain",
    asset: "/apply/realm/mountain-2.png",
    leftPct: px(557.3, SCENE_W),
    topPct: px(286.5 - HORSE_ZONE_TOP, HORSE_ZONE_H),
    widthPct: px(153.75, SCENE_W),
    mouthXPct: 8,
    mouthYPct: 32,
    bubbleSide: "left",
  },
  {
    id: 6,
    realm: "mountain",
    asset: "/apply/realm/mountain-1.png",
    leftPct: px(631.3, SCENE_W),
    topPct: px(405.5 - HORSE_ZONE_TOP, HORSE_ZONE_H),
    widthPct: px(185.4, SCENE_W),
    mouthXPct: 92,
    mouthYPct: 36,
    bubbleSide: "right",
  },
  {
    id: 7,
    realm: "ocean",
    asset: "/apply/realm/ocean-2.png",
    leftPct: px(490.3, SCENE_W),
    topPct: px(524.5 - HORSE_ZONE_TOP, HORSE_ZONE_H),
    widthPct: px(176.3, SCENE_W),
    mouthXPct: 6,
    mouthYPct: 29,
    bubbleSide: "left",
  },
  {
    id: 8,
    realm: "ocean",
    asset: "/apply/realm/ocean-1.png",
    leftPct: px(198.3, SCENE_W),
    topPct: px(577.5 - HORSE_ZONE_TOP, HORSE_ZONE_H),
    widthPct: px(251, SCENE_W),
    mouthXPct: 94,
    mouthYPct: 27,
    bubbleSide: "right",
  },
] as const;

export const getHorse = (id: number | null | undefined) =>
  horses.find((h) => h.id === id) ?? null;
