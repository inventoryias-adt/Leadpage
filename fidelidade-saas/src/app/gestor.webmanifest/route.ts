/**
 * Manifesto do app do GESTOR (dono, gerente): instalar a partir do painel (/dashboard) ou do /login cria um ícone próprio
 * que abre direto o painel. O app do cliente tem o seu manifesto (src/app/manifest.ts). O `id` diferente faz o sistema
 * tratar os dois como apps separados, mesmo no mesmo celular.
 */
export const dynamic = 'force-static';

export function GET() {
  const manifest = {
    id: '/dashboard',
    name: 'Fidelize Gestor — painel do estabelecimento',
    short_name: 'Fidelize Gestor',
    description: 'Caixa, agenda, pedidos, clientes e resultados do seu estabelecimento, no celular.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#0B1B3A',
    theme_color: '#0B1B3A',
    lang: 'pt-BR',
    icons: [
      { src: '/gestor-icon-192.png?v=1', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/gestor-icon-512.png?v=1', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/gestor-icon-maskable-512.png?v=1', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Caixa', url: '/dashboard/caixa', icons: [{ src: '/gestor-icon-96.png?v=1', sizes: '96x96', type: 'image/png' }] },
      { name: 'Agenda', url: '/dashboard/agenda', icons: [{ src: '/gestor-icon-96.png?v=1', sizes: '96x96', type: 'image/png' }] },
      { name: 'Pedidos', url: '/dashboard/pedidos', icons: [{ src: '/gestor-icon-96.png?v=1', sizes: '96x96', type: 'image/png' }] },
    ],
  };
  return new Response(JSON.stringify(manifest), { headers: { 'Content-Type': 'application/manifest+json; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
