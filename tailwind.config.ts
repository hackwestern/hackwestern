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
        violet: {
          100: "hsl(var(--violet-100))",
          200: "hsl(var(--violet-200))",
          300: "hsl(var(--violet-300))",
          400: "hsl(var(--violet-400))",
          500: "hsl(var(--violet-500))",
          600: "hsl(var(--violet-600))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
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
        "hw-gradient-radius": "3137px",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        float: {
          "0%, 100%": { transform: "translatey(0px)" },
          "50%": { transform: "translatey(-20px)" },
        },
        "inv-float": {
          "0%, 100%": { transform: "translatey(-20px)" },
          "50%": { transform: "translatey(0px)" },
        },
        "small-bounce": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(2.5%)" },
        },
        wiggle: {
          "0%, 100%": { transform: "rotate(-0.5deg)" },
          "50%": { transform: "rotate(0.5deg)" },
        },
        "suitcase-slide": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-12000px)" },
        },
        "suitcase-slide-small": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-6000px)" },
        },
        "spin-reverse": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(-360deg)" },
        },
        pulse: {
          "0%, 100%" : {
            transform: 'scale(1.05)', opacity: '1'
          },
          "50%" : {
            transform: 'scale(1.)', opacity: '0.7' 
          }
        },
        "inv-pulse": {
          "0%, 100%" : {
            transform: 'scale(1)', opacity: '0.7' 
          },
          "50%" : {
            transform: 'scale(1.05)', opacity: '1'
          }
        }
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        cloud1: "float 5s ease-in-out infinite",
        cloud2: "inv-float 6s ease-in-out infinite",
        cloud3: "float 12s ease-in-out infinite",
        cloud4: "inv-float 14s ease-in-out infinite",
        plane: "float 10s ease-in-out infinite",
        "small-bounce": "small-bounce 0.75s ease-in-out infinite",
        wiggle: "wiggle 1s ease-in-out infinite",
        "suitcase-slide": "suitcase-slide 120s linear infinite",
        "suitcase-slide-small": "suitcase-slide-small 60s linear infinite",
        "spin-reverse": "spin-reverse 2s linear infinite",
        "organizer-slide": "suitcase-slide 180s linear infinite",
        "organizer-slide-small": "suitcase-slide-small 60s linear infinite",
        "star-pulse-1": "pulse 2s cubic-bezier(0.4, 0, 0.2, 1) infinite",
        "star-pulse-2": "inv-pulse 3s cubic-bezier(0.4, 0, 0.2, 1) infinite",
        "star-pulse-3": "pulse 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite",
        "star-pulse-4": "inv-pulse 4s cubic-bezier(0.4, 0, 0.2, 1) infinite"



      },
      backgroundImage: {
        "hw-radial-gradient":
          "radial-gradient(77.76% 72.21% at 42.29% 60.83%, #FFE4D6 0%, #FFB2B7 9%, #E19CDE 18%, #B07ACA 35%, #765EA1 61%, #483CB5 100%);",
        "hw-linear-gradient-day":
          "linear-gradient(180deg, #B2C8FF 0%, #FFEAFC 100%);",
        "hw-hero-text-gradient":
          "linear-gradient(190deg, #EBA0C6 48.2%, #FFDEE0 84.16%)",
        "hw-linear-gradient":
          "linear-gradient(180deg, #8360BE 0%, #370966 57%);",
        "hw-highlight-radial-gradient":
          "radial-gradient(50% 50% at 50% 50%, rgba(255, 161, 94, 0.94) 0%, rgba(240, 110, 110, 0.92) 8.5%, rgba(244, 56, 124, 0.47) 52.5%, rgba(121, 35, 207, 0.00) 100%)",
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
