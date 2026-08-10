import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        mipc: {
          green: {
            50: '#f2f8f4', 100: '#ddefe3', 200: '#bbdec8', 300: '#8fc6a2', 400: '#5fa979',
            500: '#3c8d5b', 600: '#2b7148', 700: '#235b3c', 800: '#1d4932', 900: '#173c2a', 950: '#0a2116'
          },
          navy: {
            50: '#f0f6fc',
            100: '#e1ecf7',
            200: '#c5dcee',
            300: '#99c3e2',
            400: '#67a3d2',
            500: '#4384c1',
            600: '#2f69a5',
            700: '#265487',
            800: '#22466f',
            900: '#0b1d3a',
            950: '#061022'
          },
          gold: {
            300: '#fde047',
            400: '#facc15',
            500: '#eab308',
            600: '#ca8a04',
            700: '#a16207'
          }
        },
        ink: {
          950: '#111b17', 900: '#17241f', 800: '#25362f', 700: '#3a4c44', 600: '#596961', 500: '#74827b'
        },
        parchment: {
          50: '#FCFBF7', 100: '#F6F3EA', 200: '#ECE6D8', 300: '#DCD2BE'
        },
        brass: {
          300: '#F1D68C', 400: '#E5BE56', 500: '#C99B2E', 600: '#A77A1E', 700: '#805B18'
        },
        signal: {
          ok: '#15803d',
          'ok-bg': '#E8F5E9',
          warn: '#B0752E',
          'warn-bg': '#FFF8E1',
          danger: '#A33D3D',
          'danger-bg': '#FFEBEE'
        }
      },
      fontFamily: {
        display: ['var(--font-serif)', 'Georgia', 'serif'],
        body: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace']
      },
      boxShadow: {
        academic: '0 12px 35px -20px rgba(10, 33, 22, 0.32), 0 2px 8px rgba(10, 33, 22, 0.06)',
        'academic-lg': '0 28px 70px -30px rgba(10, 33, 22, 0.42), 0 8px 24px rgba(10, 33, 22, 0.09)'
      }
    }
  },
  plugins: []
};

export default config;
