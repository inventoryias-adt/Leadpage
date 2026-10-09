import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Fidelize — Minha carteira de pontos',
    short_name: 'Fidelize',
    description: 'Seus pontos e prêmios nos lugares que você ama.',
    start_url: '/carteira',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0F1F3D',
    lang: 'pt-BR',
    icons: [
      { src: '/icon-192.png?v=2', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png?v=2', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png?v=2', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
