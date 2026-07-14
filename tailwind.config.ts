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
        "border-light": "hsl(var(--border-light))",

        emphasis: "var(--emphasis)",
        active: "var(--active)",
        tinted: "var(--tinted)",

        heavy: tokens.colors.text.heavy,
        medium: tokens.colors.text.medium,
        light: tokens.colors.text.light,

        offwhite: tokens.colors.bg.light,
        highlight: tokens.colors.bg.highlight,

        green: tokens.colors.greens["green-primary"],

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
        "button-primary": tokens.shadows.button,
        "button-primary-active": tokens.shadows.activeButton,
        "button-secondary": tokens.shadows.secondary,
        "button-icon": tokens.shadows.icon,
      },
      fontFamily: {
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
        "telescope":"url('/cursors/telescope.webp'),pointer",
      },
      keyframes: {
        "bounce-jump": {
          "0%, 100%": { transform: "translateY(0)" },
          "30%": { transform: "translateY(-60px)" },
          "60%": { transform: "translateY(0)" },
          "80%": { transform: "translateY(-10px)" },
          "100%": { transform: "translateY(0)" },
        },
      },
      animation: {
        "bounce-jump": "bounce-jump 0.6s ease-in-out",
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
