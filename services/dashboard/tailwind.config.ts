import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Söhne", "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        // OKLCH color system for future-proof gradients
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        
        // Electric blue gradient primary
        primary: {
          DEFAULT: "oklch(var(--primary))",
          foreground: "oklch(var(--primary-foreground))",
          50: "oklch(96% 0.05 240)",
          100: "oklch(94% 0.08 240)",
          200: "oklch(89% 0.12 240)",
          300: "oklch(81% 0.18 240)",
          400: "oklch(69% 0.22 240)",
          500: "oklch(60% 0.24 240)",
          600: "oklch(52% 0.22 240)",
          700: "oklch(45% 0.18 240)",
          800: "oklch(38% 0.14 240)",
          900: "oklch(32% 0.10 240)",
        },
        
        // Emerald success
        success: {
          DEFAULT: "oklch(71% 0.18 162)",
          foreground: "oklch(98% 0.02 162)",
          glow: "oklch(71% 0.25 162 / 0.2)",
        },
        
        // Amber warning
        warning: {
          DEFAULT: "oklch(75% 0.18 85)",
          foreground: "oklch(20% 0.02 85)",
          pulse: "oklch(75% 0.22 85 / 0.2)",
        },
        
        // Ruby danger
        danger: {
          DEFAULT: "oklch(58% 0.22 25)",
          foreground: "oklch(98% 0.02 25)",
          flash: "oklch(58% 0.28 25 / 0.2)",
        },
        
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
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
      
      spacing: {
        "18": "4.5rem",
        "88": "22rem",
        "128": "32rem",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        glow: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.8", transform: "scale(1.05)" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-out": {
          "0%": { opacity: "1", transform: "translateY(0)" },
          "100%": { opacity: "0", transform: "translateY(10px)" },
        },
        "slide-in": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "slide-out": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(100%)" },
        },
        "stream": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.95)", opacity: "1" },
          "50%": { transform: "scale(1.05)", opacity: "0.7" },
          "100%": { transform: "scale(0.95)", opacity: "1" },
        },
      },
      animation: {
        shimmer: "shimmer 2s infinite linear",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        float: "float 3s ease-in-out infinite",
        glow: "glow 2s ease-in-out infinite",
        "fade-in": "fade-in 0.5s ease-out",
        "fade-out": "fade-out 0.5s ease-out",
        "slide-in": "slide-in 0.3s ease-out",
        "slide-out": "slide-out 0.3s ease-out",
        "stream": "stream 0.1s ease-out forwards",
        "pulse-ring": "pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      
      transitionTimingFunction: {
        "spring": "cubic-bezier(0.34, 1.56, 0.64, 1)",
        "bounce": "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "glassmorphism": "linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)",
        "electric-gradient": "linear-gradient(135deg, oklch(60% 0.24 240), oklch(52% 0.22 260))",
        "emerald-gradient": "linear-gradient(135deg, oklch(71% 0.18 162), oklch(65% 0.20 145))",
        "amber-gradient": "linear-gradient(135deg, oklch(75% 0.18 85), oklch(70% 0.20 75))",
        "ruby-gradient": "linear-gradient(135deg, oklch(58% 0.22 25), oklch(52% 0.24 15))",
        "mesh-gradient": "radial-gradient(at 40% 20%, oklch(96% 0.05 240) 0%, transparent 50%), radial-gradient(at 80% 0%, oklch(89% 0.12 162) 0%, transparent 50%), radial-gradient(at 10% 50%, oklch(81% 0.18 85) 0%, transparent 50%), radial-gradient(at 80% 50%, oklch(94% 0.08 25) 0%, transparent 50%), radial-gradient(at 0% 100%, oklch(89% 0.12 240) 0%, transparent 50%), radial-gradient(at 80% 100%, oklch(81% 0.18 162) 0%, transparent 50%), radial-gradient(at 0% 0%, oklch(94% 0.08 85) 0%, transparent 50%)",
      },
      
      boxShadow: {
        "glow-sm": "0 2px 10px -2px oklch(60% 0.24 240 / 0.3)",
        "glow": "0 4px 20px -4px oklch(60% 0.24 240 / 0.4)",
        "glow-lg": "0 8px 40px -8px oklch(60% 0.24 240 / 0.5)",
        "elevation-1": "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
        "elevation-2": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
        "elevation-3": "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
        "elevation-4": "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
        "elevation-5": "0 25px 50px -12px rgb(0 0 0 / 0.25)",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
export default config;
