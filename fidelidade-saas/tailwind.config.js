/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      screens: { wide: '1600px' },
      fontFamily: {
        sans: ['"Inter Variable"', 'system-ui', 'sans-serif'],
        display: ['"Inter Variable"', 'system-ui', 'sans-serif'],
      },
      // Pesos mais contidos: títulos e números firmes, sem o peso "chamativo" do extrabold.
      fontWeight: { bold: '600', extrabold: '650' },
      // Cantos menos arredondados: aparência de ferramenta profissional, não de brinquedo.
      borderRadius: { sm: '4px', DEFAULT: '6px', md: '6px', lg: '8px', xl: '8px', '2xl': '10px', '3xl': '12px' },
      colors: {
        glassBlue: 'rgba(37, 99, 235, 0.1)',
        glassWhite: 'rgba(255, 255, 255, 0.15)',
        primary: '#0F1F3D', // azul-marinho escuro para títulos
        electric: {
          400: '#5B84E6',
          500: '#2150C9', // azul principal, mais sóbrio
          600: '#1A3FA3',
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
