/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Fotos chegam como data URL já reduzida pelo navegador (~100 KB); folga para o corpo da Server Action.
  experimental: { serverActions: { bodySizeLimit: '2mb' } },
};

export default nextConfig;
