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
    "green-primary": "#539933"
  }
} as const;

// ------------------------------------------------------------
// Fonts
// ------------------------------------------------------------

export const fonts = {
  cossetteTexte: "var(--font-cossetteTexte)",
  figtree: "var(--font-figtree)",
  pix32: "var(--font-pix32)",
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
    fontFamily: fonts.figtree,//
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
    fontFamily: fonts.pix32,
    fontWeight: "400", // Pix32PixelFont maps to 400
    fontSize: "16px",
    lineHeight: "120%",
    letterSpacing: "0%",
    textTransform: "none" as const,
  },
  button2: {
    fontFamily: fonts.pix32,
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
// Button shadow (neumorphic style from Figma)
// ------------------------------------------------------------

export const shadows = {
  button: [
    "1px 1px 2px 0px rgba(0,0,0,0.24)", // drop shadow sm
    "4px 4px 10px 0px rgba(0,0,0,0.12)", // drop shadow lg
    "inset 3px 3px 0px 0px rgba(255,255,255,0.80)", // inner light top-left
    "inset -3px -3px 0px 0px rgba(5,6,8,0.60)", // inner dark bottom-right
    "inset 6px 6px 0px 0px rgba(222,223,225,0.70)", // inner highlight top-left
    "inset -6px -6px 0px 0px rgba(137,139,143,0.60)", // inner shadow bottom-right
  ].join(", "),
} as const;
