import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";
import { type PluginAPI } from "tailwindcss/types/config";

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
        heavy: "var(--heavy)",
        emphasis: "var(--emphasis)",
        tinted: "var(--tinted)",
        medium: "var(--medium)",
        light: "var(--light)",
        "faint-lilac": "var(--faint-lilac)",
        offwhite: "var(--offwhite)",
        highlight: "var(--highlight)",
        "border-light": "hsl(var(--border-light))",
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
      backgroundImage: {
        "hw-radial-gradient":
          "`\n            radial-gradient(\n              circle 150vh at 100vh 150vh,\n              var(--coral) 0%,\n              var(--salmon) 40%,\n              var(--lilac) 65%,\n              var(--beige) 90%\n            )\n          `",
        "button-primary": "linear-gradient(#D19AEE 0%, #8F57AD 100%)",
        "button-primary-hover":
          "linear-gradient(rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.1)), linear-gradient(#D19AEE 0%, #8F57AD 100%)",
        "button-primary-active":
          "linear-gradient(rgba(100, 100, 100, 0.1), rgba(100, 100, 100, 0.1)), linear-gradient(#D19AEE 0%, #8F57AD 100%)",
        "button-primary-back":
          "linear-gradient(rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.2)), linear-gradient(#D19AEE 0%, #8F57AD 100%)",
        "button-secondary-back":
          "linear-gradient(rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0.4)), linear-gradient(#FFFFFF 0%,#A893B0 100%)",
        noise: '`url("https://grainy-gradients.vercel.app/noise.svg")`',
      },
      boxShadow: {
        "button-primary": "0px 2px 4px rgba(60, 32, 76, 0.2)",
        "button-secondary": "0px 2px 4px 0px rgba(60, 32, 76, 0.20)",
      },
      fontFamily: {
        figtree: ["var(--font-figtree)"],
        dico: ["var(--font-dico)"],
        "jetbrains-mono": ["var(--font-jetbrainsmono)"],
      },
      fontSize: {
        "main-display": "4rem",
        "md-display": "3rem",
        "sm-display": "2rem",
        "lg-sub": "1.5rem",
        "sm-sub": "1rem",
        "lg-p": "1.5rem",
        "md-p": "1rem",
        "sm-p": ".875rem",
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
