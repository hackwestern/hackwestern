// ============================================================
// Design Tokens — generated from Figma Token Studio export
// ============================================================

// ------------------------------------------------------------
// Colors
// ------------------------------------------------------------

export const colors = {
  text: {
    heavy: "#042239",
    medium: "#2e547a",
    light: "#697c90",
  },
  bg: {
    light: "#f5f9ff",
    highlight: "#d7e2ef",
  },
  grays: {
    "white-0": "#ffffff",
    "gray-1": "#dedede",
    "gray-2": "#bdbdbd",
    "gray-3": "#949494",
    "gray-4": "#75777a",
    "gray-5": "#505050",
    "gray-6": "#323232",
    "gray-7": "#262626",
    "gray-8": "#191919",
    "black-9": "#111111",
  },
  blues: {
    "blue-1": "#c4e0fc",
    "blue-2": "#87bdf3",
    "blue-3": "#5aa6f1",
    "blue-4": "#3b94ec",
    "blue-5": "#176bbf",
    "blue-6": "#0e5398",
    "blue-7": "#084077",
    "blue-8": "#042239",
    "blue-9": "#05141f",
  },
  greens: {
    "green-primary": "#539933",
  },
  buttonPrimary: {
    bg: "#a7a7a7",
    border: "#999999",
    bgHover: "#bdbdbd", // = grays.gray-2
    borderHover: "#bdbdbd", // = grays.gray-2
    bgActive: "#a7a7a7",
    borderActive: "#75777a", // = grays.gray-4
    textDefault: "#262626", // = grays.gray-7
    textHover: "#75777a", // = grays.gray-4
    textActive: "#262626", // = grays.gray-7
  },
} as const;

// ------------------------------------------------------------
// Fonts
// ------------------------------------------------------------

export const fonts = {
  cossetteTexte: "var(--font-cossetteTexte)",
  figtree: "var(--font-figtree)",
  pix32: "var(--font-pix32)",
  // Semantic aliases — repoint these two when the yearly theme fonts change,
  // and everything using font-primary / font-secondary carries over automatically.
  // This year: primary = CossetteTexte (display), secondary = Pix32 (body/UI).
  // figtree is deprecated (last year's font) and being migrated out — see #794.
  primary: "var(--font-cossetteTexte)",
  secondary: "var(--font-pix32)",
} as const;

// ------------------------------------------------------------
// Typography
// ------------------------------------------------------------

export const typography = {
  h1: {
    fontFamily: fonts.cossetteTexte,
    fontWeight: "700", // Bold
    fontSize: "64px",
    lineHeight: "120%",
    letterSpacing: "0%",
    color: colors.text.heavy,
    textTransform: "none" as const,
  },
  h2: {
    fontFamily: fonts.cossetteTexte,
    fontWeight: "700",
    fontSize: "48px",
    lineHeight: "120%",
    letterSpacing: "0%",
    color: colors.text.heavy,
    textTransform: "none" as const,
  },
  h3: {
    fontFamily: fonts.cossetteTexte,
    fontWeight: "700",
    fontSize: "32px",
    lineHeight: "120%",
    letterSpacing: "0%",
    color: colors.text.heavy,
    textTransform: "none" as const,
  },
  p1: {
    fontFamily: fonts.figtree, //
    fontWeight: "500", // Medium
    fontSize: "24px", //
    lineHeight: "auto",
    letterSpacing: "0%",
    textTransform: "none" as const,
  },
  p2: {
    fontFamily: fonts.figtree,
    fontWeight: "500",
    fontSize: "16px",
    lineHeight: "auto",
    letterSpacing: "0%",
    textTransform: "none" as const,
  },
  p3: {
    fontFamily: fonts.figtree,
    fontWeight: "500",
    fontSize: "14px",
    lineHeight: "auto",
    letterSpacing: "0%",
    textTransform: "none" as const,
  },
  subtitle1: {
    fontFamily: fonts.cossetteTexte,
    fontWeight: "400", // Regular
    fontSize: "24px",
    lineHeight: "auto",
    letterSpacing: "-0.02em", // -2%
    textTransform: "uppercase" as const,
  },
  subtitle2: {
    fontFamily: fonts.cossetteTexte,
    fontWeight: "400",
    fontSize: "18px",
    lineHeight: "auto",
    letterSpacing: "-0.02em",
    textTransform: "uppercase" as const,
  },
  button1: {
    fontFamily: fonts.figtree,
    fontWeight: "400",
    fontSize: "16px",
    lineHeight: "120%",
    letterSpacing: "0%",
    textTransform: "none" as const,
  },
  button2: {
    fontFamily: fonts.figtree,
    fontWeight: "400",
    fontSize: "14px",
    lineHeight: "100%",
    letterSpacing: "0%",
    textTransform: "none" as const,
  },
} as const;

// ------------------------------------------------------------
// Spacing (8pt grid), default tailwind
// ------------------------------------------------------------

export const spacing = {
  "0": "0px",
  "1": "4px",
  "2": "8px",
  "3": "12px",
  "4": "16px",
  "5": "24px",
  "6": "32px",
  "7": "48px",
  "8": "64px",
  "9": "80px",
  "10": "96px",
} as const;

// ------------------------------------------------------------
// Border Radius, default tailwind
// ------------------------------------------------------------

export const radius = {
  none: "0px",
  sm: "4px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  full: "9999px",
} as const;

// ------------------------------------------------------------
// Button shadow (chrome pill style from Figma)
// ------------------------------------------------------------

export const shadows = {
  // Default state: outer drop shadow + tall inner bottom glow
  button: [
    "0px 8px 12px 0px rgba(31,48,73,0.24)", // outer drop shadow
    "inset 0px -16px 10px 0px rgba(255,255,255,0.6)", // inner bottom glow
  ].join(", "),
  // Hover state: same shadow shape as default, only border/bg/text change
  buttonHover: [
    "0px 8px 12px 0px rgba(31,48,73,0.24)", // outer drop shadow
    "inset 0px -16px 10px 0px rgba(255,255,255,0.6)", // inner bottom glow
  ].join(", "),
  // Active/pressed state: same outer shadow, shallower inner glow = pressed-in look
  activeButton: [
    "0px 8px 12px 0px rgba(31,48,73,0.24)", // outer drop shadow
    "inset 0px -6px 10px 0px rgba(255,255,255,0.6)", // shallower inner glow
  ].join(", "),
  primary2: [
    "0px 8px 12px 0px rgba(31,48,73,0.24)", // outer drop shadow
    "inset 0px -12px 10px 0px rgba(255,255,255,0.4)", // inner glow
  ].join(", "),
  secondary: [
    "0px 2px 8px 0px rgba(0,0,0,0.12)", // drop shadow sm
  ].join(", "),
  icon: [
    "inset -1px -1px 0px 0px rgba(10,10,10)", //inner shadow bottom-right
    "inset 1px 1px 0px 0px rgba(255,255,255)", //inner highlight top-left
    "inset -2px -2px 0px 0px rgba(128,128,128)", //inner shadow bottom-right
    "inset 2px 2px 0px 0px rgba(223,223,223)", //inner
  ].join(", "),
} as const;
