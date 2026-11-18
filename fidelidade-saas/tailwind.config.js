/** @type {import('tailwindcss').Config} */
module.exports = {
  // `hover:` só vale em aparelhos com mouse: no celular o efeito não fica "grudado" depois do toque.
  future: { hoverOnlyWhenSupported: true },
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      screens: { wide: '1600px' },
      fontFamily: {
        sans: ['"Figtree Variable"', '"Inter Variable"', 'system-ui', 'sans-serif'],
        display: ['"Figtree Variable"', '"Inter Variable"', 'system-ui', 'sans-serif'],
      },
      // Pesos mais contidos: títulos e números firmes, sem o peso "chamativo" do extrabold.
      fontWeight: { bold: '600', extrabold: '650' },
      // Cantos macios, como no material de apresentação: cartões e botões mais amigáveis, sem virar brinquedo.
      borderRadius: { sm: '6px', DEFAULT: '8px', md: '10px', lg: '14px', xl: '18px', '2xl': '22px', '3xl': '28px' },
      colors: {
        primary: '#12241C', // verde-floresta escuro: títulos, cartão e fundos escuros
        // Cor de ação (botões, links, destaques sobre fundo claro).
        acao: {
          400: '#4F8F73',
          500: '#1E5B43',
          600: '#174A36', // um tom mais fundo (hover e texto sobre fundo claro)
        },
        papel: '#F5F3EC', // fundo
        // Dourado: o F e os destaques sobre fundos escuros (nunca em fundos grandes nem como texto sobre fundo claro).
        ouro: { DEFAULT: '#E9C46A', deep: '#D4A94A' },
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
