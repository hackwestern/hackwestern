import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";
import { type PluginAPI } from "tailwindcss/types/config";
import * as tokens from "./src/lib/tokens";

const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
    },
    screens: {
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1600px",
      "3xl": "2000px",
      "4xl": "3000px",
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        githubbg: "#1b1f23",
        beige: "var(--beige)",
        coral: "var(--coral)",
        lilac: "var(--lilac)",
        salmon: "var(--salmon)",
        "faint-lilac": "var(--faint-lilac)",
        "border-light": "var(--border-light)",

        emphasis: "var(--emphasis)",
        active: "var(--active)",
        tinted: "var(--tinted)",

        heavy: tokens.colors.text.heavy,
        medium: tokens.colors.text.medium,
        light: tokens.colors.text.light,

        offwhite: tokens.colors.bg.light,
        highlight: tokens.colors.bg.highlight,
        "promo-sheet": tokens.colors.bg.promoSheet,

        green: tokens.colors.greens["green-primary"],
        "green-dark": tokens.colors.greens["green-dark"],

        primary: {
          "50": "hsl(var(--primary-50))",
          "100": "hsl(var(--primary-100))",
          "200": "hsl(var(--primary-200))",
          "300": "hsl(var(--primary-300))",
          "400": "hsl(var(--primary-400))",
          "500": "hsl(var(--primary-500))",
          "600": "hsl(var(--primary-600))",
          "700": "hsl(var(--primary-700))",
          "800": "hsl(var(--primary-800))",
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        gray: {
          "0": tokens.colors.grays["white-0"],
          "1": tokens.colors.grays["gray-1"],
          "2": tokens.colors.grays["gray-2"],
          "3": tokens.colors.grays["gray-3"],
          "4": tokens.colors.grays["gray-4"],
          "5": tokens.colors.grays["gray-5"],
          "6": tokens.colors.grays["gray-6"],
          "7": tokens.colors.grays["gray-7"],
          "8": tokens.colors.grays["gray-8"],
        },
        blue: {
          "1": tokens.colors.blues["blue-1"],
          "2": tokens.colors.blues["blue-2"],
          "3": tokens.colors.blues["blue-3"],
          "4": tokens.colors.blues["blue-4"],
          "5": tokens.colors.blues["blue-5"],
          "6": tokens.colors.blues["blue-6"],
          "7": tokens.colors.blues["blue-7"],
          "8": tokens.colors.blues["blue-8"],
          "9": tokens.colors.blues["blue-9"],
        },

        secondary: "hsl(var(--secondary))",
        "button-secondary": "rgb(244, 242, 247)",
        "button-secondary-hover": "rgb(248, 247, 249)",
        "button-secondary-active": "rgb(253, 252, 253)",

        "button-primary": tokens.colors.buttonPrimary.bg,
        "button-primary-border": tokens.colors.buttonPrimary.border,
        "button-primary-hover": tokens.colors.buttonPrimary.bgHover,
        "button-primary-hover-border": tokens.colors.buttonPrimary.borderHover,
        "button-primary-active": tokens.colors.buttonPrimary.bgActive,
        "button-primary-active-border":
          tokens.colors.buttonPrimary.borderActive,
        violet: {
          "100": "hsl(var(--violet-100))",
          "200": "hsl(var(--violet-200))",
          "300": "hsl(var(--violet-300))",
          "400": "hsl(var(--violet-400))",
          "500": "hsl(var(--violet-500))",
          "600": "hsl(var(--violet-600))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          dark: "hsl(var(--destructive-dark))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "hw-gradient-radius": "60vw",
      },
      boxShadow: {
        "primary-btn": tokens.shadows.button,
        "primary-btn-hover": tokens.shadows.buttonHover,
        "primary-btn-active": tokens.shadows.activeButton,
        "primary-btn-2": tokens.shadows.primary2,
        "secondary-btn": tokens.shadows.secondary,
        "icon-btn": tokens.shadows.icon,
      },
      fontFamily: {
        primary: [tokens.fonts.primary],
        secondary: [tokens.fonts.secondary],
        figtree: ["var(--font-figtree)"],
        cossetteTexte: [tokens.fonts.cossetteTexte],
        pix32: [tokens.fonts.pix32],
      },
      fontSize: {
        "main-display": "4rem", //h1
        "md-display": "3rem", //h2
        "sm-display": "2rem", //h3
        "lg-sub": "1.5rem", //sub-lg
        "sm-sub": "1.125rem", //sub-sm
        "lg-p": "1.5rem", //p1
        "md-p": "1rem", //p2
        "sm-p": ".875rem", //p3
        "lg-b": "1rem", //button-lg
        "sm-b": "0.875rem", //button-sm
      },
      lineHeight: {
        default: "1.2",
      },
      letterSpacing: {
        default: "0em",
        subtitle: "-0.02em",
      },
      width: {
        "3xs": "16rem",
        "2xs": "18rem",
        xs: "20rem",
        sm: "24rem",
        md: "28rem",
        lg: "32rem",
        xl: "36rem",
        "2xl": "42rem",
        "3xl": "48rem",
        "4xl": "56rem",
        "5xl": "64rem",
        "6xl": "72rem",
        "7xl": "80rem",
      },
      height: {
        "3xs": "16rem",
        "2xs": "18rem",
        xs: "20rem",
        sm: "24rem",
        md: "28rem",
        lg: "32rem",
        xl: "36rem",
        "2xl": "42rem",
        "3xl": "48rem",
        "4xl": "56rem",
        "5xl": "64rem",
        "6xl": "72rem",
        "7xl": "80rem",
      },
      cursor: {
        "pixel-default": "url('/cursors/cursor-default.webp'),auto",
        "pixel-hover": "url('/cursors/hover-hand.webp'),pointer",
        telescope: "url('/cursors/telescope.webp'),pointer",
      },
      keyframes: {
        "bounce-jump": {
          "0%, 100%": { transform: "translateY(0)" },
          "30%": { transform: "translateY(-60px)" },
          "60%": { transform: "translateY(0)" },
          "80%": { transform: "translateY(-10px)" },
          "100%": { transform: "translateY(0)" },
        },
        "team-marquee": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        "team-glow": {
          "0%": { opacity: "0" },
          "15%": { opacity: "0.35" },
          "100%": { opacity: "0" },
        },
        // Same number of drop-shadows at both ends so the filter interpolates.
        "glow-pulse": {
          "0%, 100%": {
            filter:
              "drop-shadow(0 0 0 rgb(255 214 90 / 0)) drop-shadow(0 0 0 rgb(255 214 90 / 0))",
          },
          "50%": {
            filter:
              "drop-shadow(0 0 1.5px rgb(255 214 90)) drop-shadow(0 0 6px rgb(255 214 90))",
          },
        },
        // Where it starts, holds and ends come from --pop-from/-mid/-to, so
        // the same pop can rise above an item or sink below an edge.
        "pop-arrow": {
          "0%": {
            opacity: "0",
            transform: "translate(-50%, var(--pop-from)) scale(0.9)",
          },
          "16%, 64%": {
            opacity: "1",
            transform: "translate(-50%, var(--pop-mid)) scale(1)",
          },
          "100%": {
            opacity: "0",
            transform: "translate(-50%, var(--pop-to)) scale(0.96)",
          },
        },
        "flag-wave": {
          "0%, 100%": { transform: "skewY(0deg) scaleX(1)" },
          "50%": { transform: "skewY(-5deg) scaleX(0.94)" },
        },
        // A quick wiggle, then a long rest, so it reads as an occasional nudge.
        wiggle: {
          "0%, 16%, 100%": { transform: "rotate(0deg)" },
          "2%": { transform: "rotate(-8deg)" },
          "4%": { transform: "rotate(8deg)" },
          "6%": { transform: "rotate(-6deg)" },
          "8%": { transform: "rotate(6deg)" },
          "10%": { transform: "rotate(-3deg)" },
          "12%": { transform: "rotate(3deg)" },
        },
      },
      animation: {
        "pop-arrow": "pop-arrow 1.2s ease-out forwards",
        "flag-wave": "flag-wave 2.4s ease-in-out infinite",
        "bounce-jump": "bounce-jump 0.6s ease-in-out",
        "team-marquee": "team-marquee 80s linear infinite",
        "team-glow": "team-glow 2.5s ease-out forwards",
        "glow-pulse": "glow-pulse 2.8s ease-in-out infinite",
        wiggle: "wiggle 3.5s ease-in-out infinite",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    plugin(function (this: void, api: PluginAPI) {
      api.addUtilities({
        ".backface-hidden": { backfaceVisibility: "hidden" },
        ".preserve-3d": { transformStyle: "preserve-3d" },
      });
    }),
  ],
} satisfies Config;

export default config;
