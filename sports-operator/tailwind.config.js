/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0b0f14',
        panel: '#121821',
        panel2: '#171f2b',
        border: '#232d3b',
        accent: '#22c55e',
        accent2: '#3b82f6',
        warn: '#f59e0b',
        danger: '#ef4444',
        muted: '#8b98a9'
      }
    }
  },
  plugins: []
};
