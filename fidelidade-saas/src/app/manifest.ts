import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Fidelize — Minha carteira de pontos',
    short_name: 'Fidelize',
    description: 'Seus pontos e prêmios nos restaurantes que você ama.',
    start_url: '/carteira',
    scope: '/',
    display: 'standalone',
    background_color: '#eaf3ff',
    theme_color: '#2f6bff',
    lang: 'pt-BR',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
