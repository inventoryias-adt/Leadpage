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
      // Cantos macios, como no material de apresentação: cartões e botões mais amigáveis, sem virar brinquedo.
      borderRadius: { sm: '6px', DEFAULT: '8px', md: '10px', lg: '14px', xl: '18px', '2xl': '22px', '3xl': '28px' },
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
        // Lima da marca: só em pontos-chave (botão principal do caixa, aba ativa no celular, destaques), nunca em fundos grandes.
        lima: { DEFAULT: '#C6F432', deep: '#B3E01C' },
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
        // Convite a deslizar: a setinha do carrossel balança até a primeira rolagem.
        nudge: {
          '0%, 100%': { transform: 'translate(0, -50%)' },
          '50%': { transform: 'translate(6px, -50%)' },
        },
      },
      animation: {
        blob: 'blob 14s ease-in-out infinite',
        'fade-in': 'fade-in 0.35s ease-out both',
        nudge: 'nudge 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
