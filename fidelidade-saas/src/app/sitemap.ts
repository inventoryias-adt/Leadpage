import type { MetadataRoute } from 'next';

const base = () => (process.env.APP_URL ?? 'https://fidelize-nu.vercel.app').replace(/\/$/, '');

/** Páginas públicas que vale a pena aparecer na busca. */
export default function sitemap(): MetadataRoute.Sitemap {
  const url = base();
  return [
    { url: `${url}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${url}/quero-o-fidelize`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${url}/entrar`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${url}/termos`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${url}/termos/estabelecimento`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${url}/termos/cliente`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${url}/privacidade`, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
