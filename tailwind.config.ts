import type { Config } from "tailwindcss";

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
      "2xl": "1536px",
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
        light: "var(--light)",
        highlight: "var(--highlight)",
        heavy: "var(--heavy)",
        medium: "var(--medium)",
        "border-light": "hsl(var(--border-light))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          50: "hsl(var(--primary-50))",
          100: "hsl(var(--primary-100))",
          200: "hsl(var(--primary-200))",
          300: "hsl(var(--primary-300))",
          400: "hsl(var(--primary-400))",
          500: "hsl(var(--primary-500))",
          600: "hsl(var(--primary-600))",
          700: "hsl(var(--primary-700))",
          800: "hsl(var(--primary-800))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: "hsl(var(--secondary))",
        "button-secondary": "rgb(250, 250, 250)",
        "button-secondary-hover": "rgb(255, 255, 255)",
        "button-secondary-active": "rgb(253, 252, 253)",
        "button-secondary-back": "rgba(170, 170, 170)",
        violet: {
          100: "hsl(var(--violet-100))",
          200: "hsl(var(--violet-200))",
          300: "hsl(var(--violet-300))",
          400: "hsl(var(--violet-400))",
          500: "hsl(var(--violet-500))",
          600: "hsl(var(--violet-600))",
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
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "hw-gradient-radius": "1027px",
      },
      backgroundImage: {
        "hw-radial-gradient": `
            radial-gradient(
              circle at bottom,
              var(--coral) 0%,
              var(--salmon) 36%,
              var(--lilac) 73%,
              var(--beige) 100%
            )
          `,
        "button-primary": "linear-gradient(#8F57AD 0%, #D19AEE 100%)",
        "button-primary-hover":
          "linear-gradient(rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.1)), linear-gradient(#8F57AD 0%, #D19AEE 100%)",
        "button-primary-active": "linear-gradient(#763896 0%, #B879DA 100%)",
        "button-primary-back":
          "linear-gradient(rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.1)), linear-gradient(#8F57AD 0%, #D19AEE 100%)",
      },
      boxShadow: {
        "button-primary": "0px 2px 4px rgba(60, 32, 76, 0.2)",
      },
      fontFamily: {
        DM_Sans: ["var(--font-dmsans)"],
        MagicRetro: ["var(--font-magicretro)"],
        Borel: ["var(--font-salsa)"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

export default config;
