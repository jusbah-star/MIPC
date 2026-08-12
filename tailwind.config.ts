import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        mipc: {
          green: {
            50: '#f2f8f5',
            100: '#dcefe5',
            200: '#bbdfca',
            300: '#8bc6a5',
            400: '#58a77e',
            500: '#338962',
            600: '#246e4f',
            700: '#1d5942',
            800: '#174735',
            900: '#123a2c',
            950: '#082219'
          },
          navy: {
            50: '#f4f7fb',
            100: '#e8eef6',
            200: '#d1ddeb',
            300: '#adc2da',
            400: '#82a1c4',
            500: '#6282ad',
            600: '#4e6892',
            700: '#405577',
            800: '#374762',
            900: '#273447',
            950: '#17202f'
          },
          gold: {
            50: '#fff9eb',
            100: '#fdefc7',
            200: '#f9de8a',
            300: '#f4c94f',
            400: '#eab52f',
            500: '#d79b1f',
            600: '#b87818',
            700: '#925716'
          }
        },
        ink: {
          950: '#101814',
          900: '#17211d',
          800: '#26322d',
          700: '#3c4943',
          600: '#5a6761',
          500: '#77827d',
          400: '#9ba39f'
        },
        parchment: {
          50: '#fbfcfb',
          100: '#f5f7f5',
          200: '#e8ece9',
          300: '#d8ded9'
        },
        brass: {
          50: '#fff9eb',
          100: '#fdefc7',
          200: '#f9de8a',
          300: '#f4c94f',
          400: '#eab52f',
          500: '#d79b1f',
          600: '#b87818',
          700: '#925716'
        },
        signal: {
          ok: '#177245',
          'ok-bg': '#eaf7ef',
          warn: '#a56518',
          'warn-bg': '#fff6e5',
          danger: '#b43f4d',
          'danger-bg': '#fff0f1'
        }
      },
      fontFamily: {
        display: ['var(--font-display)', 'Inter', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace']
      },
      boxShadow: {
        xs: '0 1px 2px rgba(16, 24, 20, 0.05)',
        academic: '0 1px 2px rgba(16, 24, 20, 0.04), 0 8px 24px -16px rgba(16, 24, 20, 0.18)',
        'academic-lg': '0 24px 60px -30px rgba(16, 24, 20, 0.30), 0 10px 30px -24px rgba(16, 24, 20, 0.20)',
        float: '0 18px 50px -24px rgba(8, 34, 25, 0.34)'
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.75rem'
      }
    }
  },
  plugins: []
};

export default config;
