import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        accent: 'var(--accent)',
        'accent-d': 'var(--accent-d)',
        'accent-text': 'var(--accent-text)',
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        surface2: 'var(--surface2)',
        border: 'var(--border)',
        border2: 'var(--border2)',
        text: 'var(--text)',
        'text-2': 'var(--text-2)',
        'text-3': 'var(--text-3)',
        danger: 'var(--danger)',
        success: 'var(--success)',
        warn: 'var(--warn)',
      },
      fontFamily: {
        mono: ['DM Mono', 'monospace'],
        display: ['Syne', 'sans-serif'],
        sans: ['Syne', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: 'var(--r)',
      },
    },
  },
  plugins: [],
};

export default config;
