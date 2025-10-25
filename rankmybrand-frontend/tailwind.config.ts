import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',

        // ===========================================
        // PROFESSIONAL B2B MONOCHROME COLOR SYSTEM
        // ===========================================
        // True neutral grayscale - THE FOUNDATION
        neutral: {
          0:   '#ffffff',  // Pure white - backgrounds (light mode)
          50:  '#fafafa',  // Off-white - subtle backgrounds, hover states
          100: '#f5f5f5',  // Light gray - cards, panels
          200: '#e5e5e5',  // Lighter border - subtle separators
          300: '#d4d4d4',  // Border - visible separation
          400: '#a3a3a3',  // Disabled text, placeholder
          500: '#737373',  // Secondary text, muted content
          600: '#525252',  // Body text - primary reading
          700: '#404040',  // Headings - strong emphasis
          800: '#262626',  // Dark headings - maximum emphasis
          900: '#171717',  // Near black - hero text, key numbers
          950: '#0a0a0a',  // True black - dark mode background
        },

        // ===========================================
        // SEMANTIC COLORS - DATA VISUALIZATION ONLY
        // ===========================================
        // SUCCESS (Green) - ONLY for positive metrics/data
        success: {
          DEFAULT: 'hsl(var(--success))',
          50:  '#f0fdf4',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          foreground: 'hsl(var(--success-foreground))',
        },

        // DANGER (Red) - ONLY for negative metrics/data
        danger: {
          DEFAULT: 'hsl(var(--danger))',
          50:  '#fef2f2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          foreground: 'hsl(var(--danger-foreground))',
        },

        // WARNING (Amber) - ONLY for alerts/caution
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          50:  '#fffbeb',
          500: '#f59e0b',
          600: '#d97706',
          foreground: 'hsl(var(--warning-foreground))',
        },

        // INTERACTIVE (Blue) - ONLY for links/CTAs
        interactive: {
          DEFAULT: 'hsl(var(--interactive))',
          50:  '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          foreground: 'hsl(var(--interactive-foreground))',
        },

        // ===========================================
        // LEGACY ALIASES (for backward compatibility)
        // ===========================================
        primary: {
          DEFAULT: 'hsl(var(--interactive))',  // Map to interactive blue
          foreground: 'hsl(var(--interactive-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--danger))',  // Map to danger red
          foreground: 'hsl(var(--danger-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      fontFamily: {
        // Professional font stack
        sans: ['Inter var', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Monaco', 'Courier New', 'monospace'], // For ALL numbers
      },
      fontSize: {
        // Fluid typography for professional readability
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],      // Minimum 16px for body text
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],           // For large metrics
        '6xl': ['3.75rem', { lineHeight: '1' }],
        '7xl': ['4.5rem', { lineHeight: '1' }],
        '8xl': ['6rem', { lineHeight: '1' }],
        '9xl': ['8rem', { lineHeight: '1' }],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        // Professional elevation system (subtle, not dramatic)
        'elevation-low': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'elevation-medium': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'elevation-high': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
      },
      spacing: {
        // Professional spacing scale
        '18': '4.5rem',   // 72px
        '22': '5.5rem',   // 88px
        '26': '6.5rem',   // 104px
        '30': '7.5rem',   // 120px
      },
      letterSpacing: {
        // For uppercase section headers
        'wider': '0.05em',
        'widest': '0.1em',
      },
      keyframes: {
        // Keep only professional, subtle animations
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        // Remove playful animations like 'float', 'glow'
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        shimmer: 'shimmer 2s infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
