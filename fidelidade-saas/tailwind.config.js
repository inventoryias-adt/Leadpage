/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        glassBlue: 'rgba(37, 99, 235, 0.1)',
        glassWhite: 'rgba(255, 255, 255, 0.15)',
        primary: '#1E3A8A', // azul forte para textos/títulos
        electric: {
          400: '#38BDF8',
          500: '#2F6BFF',
          600: '#1D4ED8',
        },
        ice: '#F4F8FF',
      },
      backgroundImage: {
        'liquid-bg':
          'radial-gradient(1200px 600px at 10% -10%, #dbeafe 0%, transparent 60%), radial-gradient(900px 500px at 100% 10%, #e0f2fe 0%, transparent 55%), linear-gradient(135deg, #eaf3ff 0%, #ffffff 100%)',
      },
      keyframes: {
        blob: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(30px, -40px) scale(1.08)' },
          '66%': { transform: 'translate(-24px, 24px) scale(0.94)' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        blob: 'blob 14s ease-in-out infinite',
        'fade-in': 'fade-in 0.35s ease-out both',
      },
    },
  },
  plugins: [],
};
