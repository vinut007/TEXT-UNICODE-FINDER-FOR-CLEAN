/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#050a14',
          900: '#0a1120',
          850: '#0d1526',
          800: '#111c31',
          700: '#182743',
          600: '#223556',
        },
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          raised: 'rgb(var(--surface-raised) / <alpha-value>)',
          overlay: 'rgb(var(--surface-overlay) / <alpha-value>)',
        },
        line: 'rgb(var(--line) / <alpha-value>)',
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          muted: 'rgb(var(--ink-muted) / <alpha-value>)',
          faint: 'rgb(var(--ink-faint) / <alpha-value>)',
        },
        accent: {
          sky: '#38bdf8',
          sky2: '#7dd3fc',
          yellow: '#facc15',
          yellow2: '#fde047',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 2px rgba(0,0,0,.3), 0 8px 24px -12px rgba(0,0,0,.5)',
        glow: '0 0 0 1px rgba(56,189,248,.25), 0 0 24px -6px rgba(56,189,248,.35)',
        'glow-yellow': '0 0 0 1px rgba(250,204,21,.25), 0 0 24px -6px rgba(250,204,21,.3)',
      },
      keyframes: {
        scanline: {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '10%': { opacity: '1' },
          '90%': { opacity: '1' },
          '100%': { transform: 'translateY(1200%)', opacity: '0' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '.6', transform: 'scale(1.06)' },
        },
        'gradient-x': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        shimmer: {
          from: { backgroundPosition: '200% 0' },
          to: { backgroundPosition: '-200% 0' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.25' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'slide-in-left': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
      },
      animation: {
        scanline: 'scanline 2.4s cubic-bezier(.4,0,.6,1) infinite',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'gradient-x': 'gradient-x 6s ease infinite',
        'fade-up': 'fade-up .45s cubic-bezier(.22,1,.36,1) both',
        'fade-in': 'fade-in .3s ease both',
        shimmer: 'shimmer 2s linear infinite',
        blink: 'blink 1.1s step-end infinite',
        'slide-in-right': 'slide-in-right .25s cubic-bezier(.22,1,.36,1) both',
        'slide-in-left': 'slide-in-left .25s cubic-bezier(.22,1,.36,1) both',
      },
    },
  },
  plugins: [],
};
