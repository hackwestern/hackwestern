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
      cursor: {
        grab: "cursor-[url('/customcursor.svg'),auto]",
        grabbing: "cursor-[url('/customcursor.svg'),auto]"
      },
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
        medium: "var(--medium)",
        light: "var(--light)",
        offwhite: "var(--offwhite)",
        highlight: "var(--highlight)",
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
        "hw-gradient-radius": "60vw"  ,
      },
      backgroundImage: {
        "hw-radial-gradient": `
            radial-gradient(
              circle 150vh at 100vh 150vh,
              var(--coral) 0%,
              var(--salmon) 40%,
              var(--lilac) 65%,
              var(--beige) 90%
            )
          `,
        "button-primary": "linear-gradient(#D19AEE 0%, #8F57AD 100%)",
        "button-primary-hover":
          "linear-gradient(rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.1)), linear-gradient(#D19AEE 0%, #8F57AD 100%)",
        "button-primary-active":
          "linear-gradient(rgba(100, 100, 100, 0.1), rgba(100, 100, 100, 0.1)), linear-gradient(#D19AEE 0%, #8F57AD 100%)",
        "button-primary-back":
          "linear-gradient(rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.2)), linear-gradient(#D19AEE 0%, #8F57AD 100%)",
        "button-secondary-back":
          "linear-gradient(rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0.4)), linear-gradient(#FFFFFF 0%,#A893B0 100%)",
        "noise":
          `url("https://grainy-gradients.vercel.app/noise.svg")`
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
        'main-display': '4rem',
        'md-display': '3rem',
        'sm-display': '2rem',
        'lg-sub': '1.5rem',
        'sm-sub': '1rem',
        'lg-p': '1.5rem',
        'md-p': '1rem',
        'sm-p': '.875rem'
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

export default config;
