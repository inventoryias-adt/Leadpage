import type { MetadataRoute } from 'next';

const base = () => (process.env.APP_URL ?? 'https://fidelize-nu.vercel.app').replace(/\/$/, '');

/** O que os buscadores podem ler: só as páginas públicas. Painel, carteira, admin e rotas internas ficam de fora. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/dashboard', '/admin', '/carteira', '/perfil', '/avisos', '/r/', '/convite', '/redefinir', '/pagamento', '/login'] }],
    sitemap: `${base()}/sitemap.xml`,
  };
}
