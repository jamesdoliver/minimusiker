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
        // CSS Variable-based colors (for dynamic theming)
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
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

        // Custom MiniMusiker Brand Colors
        minimusik: {
          heading: '#2F4858',   // Dark teal for headings
          accent: '#FE4980',    // Bright pink for emphasis
          body: '#000000',      // Black body text
        },
        // Teacher Portal v2 Design Tokens
        mm: {
          'primary-dark': '#1e3a4c',  // Header, hero background
          'accent': '#d85a6a',        // Buttons, coral sections
          'bg-light': '#f7f7f7',      // Page background
          'bg-muted': '#e8e8e8',      // Contact section
          'success': '#4caf50',       // Checkmarks
          'warning': '#f5a623',       // Alert icons
        },
        sage: {
          50: '#F7FAF9',   // Lightest sage
          100: '#EBF3F1',  // Very light sage
          200: '#D8E7E3',  // Light sage
          300: '#C4DBD5',  // Light-medium sage
          400: '#A9C8C1',  // Medium-light sage
          500: '#94B8B3',  // Primary sage (main brand color)
          600: '#7A9E99',  // Medium-dark sage
          700: '#6B8B84',  // Dark sage (for text/emphasis)
          800: '#546E69',  // Darker sage
          900: '#3D504C',  // Darkest sage
        },
        cream: {
          50: '#FDFCFA',   // Lightest cream
          100: '#FBF9F4',  // Very light cream
          200: '#F9F6EE',  // Primary background cream
          300: '#F5F0E4',  // Medium-light cream
          400: '#EDE4D3',  // Medium cream
          500: '#E8D5C7',  // Warm accent cream
          600: '#D4B5A5',  // Medium-dark cream
          700: '#BF9582',  // Dark cream
          800: '#9F7862',  // Darker cream
          900: '#7E5C45',  // Darkest cream
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-rubik)', 'system-ui', 'sans-serif'],
        heading: ['var(--font-grandstander)', 'sans-serif'],
        button: ['var(--font-amaranth)', 'sans-serif'],
        playfair: ['var(--font-playfair)', 'Georgia', 'serif'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-out': {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        'slide-in': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        'slide-out': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.5s ease-out',
        'fade-out': 'fade-out 0.5s ease-out',
        'slide-in': 'slide-in 0.3s ease-out',
        'slide-out': 'slide-out 0.3s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;