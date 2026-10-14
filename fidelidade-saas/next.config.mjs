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
  // Fotos chegam como data URL já reduzida pelo navegador (~100 KB); folga para o corpo da Server Action.
  experimental: { serverActions: { bodySizeLimit: '2mb' } },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
