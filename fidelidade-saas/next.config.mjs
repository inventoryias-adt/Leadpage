/** Cabeçalhos de segurança em todas as respostas. Sem CSP por enquanto: o app usa estilos inline e mapa/fotos de terceiros, e uma política mal ajustada quebraria telas. */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  // GPS (check-in, "Onde está?") e câmera ficam só para o próprio app; microfone, pagamento e USB, nunca.
  { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(self), microphone=(), payment=(), usb=()' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Metadados sempre no <head> do HTML inicial, para qualquer navegador. Por padrão o Next 15 "transmite" os metadados
  // para o fim do <body>, e o iPhone (Safari e Chrome) só lê o <link rel="manifest"> e o apple-mobile-web-app-title no
  // <head>: o "Adicionar à Tela de Início" do painel ignorava o /gestor.webmanifest e instalava o app do cliente (/carteira).
  htmlLimitedBots: /.*/,
  // Só no modo desenvolvimento (os testes de tela do CI): mantém as rotas já compiladas na memória em vez de descartá-las depois de um tempo parado,
  // para a volta a uma tela não ter de compilar de novo (isso passava de 60 s no CI e estourava a navegação).
  onDemandEntries: { maxInactiveAge: 60 * 60 * 1000, pagesBufferLength: 200 },
  // Fotos chegam como data URL já reduzida pelo navegador (~100 KB); folga para o corpo da Server Action.
  experimental: { serverActions: { bodySizeLimit: '2mb' } },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
