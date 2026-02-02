import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand palette (keep for explicit usage)
        primary: {
          50: '#fef7ee',
          100: '#fdedd6',
          200: '#f9d7ad',
          300: '#f5bb79',
          400: '#f09443',
          500: '#ec7620',
          600: '#dd5c16',
          700: '#b74514',
          800: '#923718',
          900: '#762f16',
          950: '#401509',
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        manchengo: {
          orange: '#ec7620',
          dark: '#1a1a2e',
          light: '#f8f9fa',
        },
        // shadcn CSS variable bindings
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      borderRadius: {
        'apple-sm': '6px',
        'apple-md': '10px',
        'apple-lg': '16px',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        'apple-card': '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
        'apple-elevated': '0 4px 16px rgba(0,0,0,0.08)',
        'apple-hover': '0 2px 8px rgba(0,0,0,0.06)',
      },
      fontSize: {
        'apple-display': ['28px', { lineHeight: '34px', fontWeight: '600' }],
        'apple-title': ['20px', { lineHeight: '26px', fontWeight: '600' }],
        'apple-headline': ['17px', { lineHeight: '22px', fontWeight: '600' }],
        'apple-body': ['15px', { lineHeight: '22px', fontWeight: '400' }],
        'apple-caption': ['13px', { lineHeight: '18px', fontWeight: '400' }],
        'apple-footnote': ['11px', { lineHeight: '14px', fontWeight: '500' }],
      },
    },
  },
  plugins: [],
};

export default config;
