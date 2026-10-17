/**
 * Manifesto do app do CLIENTE (carteira de pontos). Fica como rota (e não no arquivo especial `manifest.ts`) para que o
 * painel do gestor possa apontar para o seu próprio manifesto (`/gestor.webmanifest`); o arquivo especial tem prioridade
 * e impediria essa troca.
 */
export const dynamic = 'force-static';

export function GET() {
  const manifest = {
    id: '/carteira',
    name: 'Fidelize — Minha carteira de pontos',
    short_name: 'Fidelize',
    description: 'Seus pontos e prêmios nos lugares que você ama.',
    start_url: '/carteira',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0B1B3A',
    lang: 'pt-BR',
    icons: [
      { src: '/icon-192.png?v=5', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png?v=5', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png?v=5', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  return new Response(JSON.stringify(manifest), { headers: { 'Content-Type': 'application/manifest+json; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
