import type { Metadata, Viewport } from 'next';
import { NoAutofill } from '@/components/NoAutofill';
import { RegisterSW } from '@/components/RegisterSW';
import '@fontsource-variable/inter';
import '@fontsource-variable/dm-sans';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Fidelize — Programa de pontos para restaurantes', template: '%s · Fidelize' },
  description:
    'Sistema de recompensas por pontos para restaurantes: faça o cliente voltar, receba mais avaliações no Google e posts no Instagram.',
  applicationName: 'Fidelize',
  metadataBase: new URL(process.env.APP_URL ?? 'https://fidelize-nu.vercel.app'),
  icons: {
    icon: [
      { url: '/icon-48.png', sizes: '48x48', type: 'image/png' },
      { url: '/icon-96.png', sizes: '96x96', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    type: 'website',
    siteName: 'Fidelize',
    locale: 'pt_BR',
    title: 'Fidelize — Programa de pontos para restaurantes',
    description: 'Faça o cliente voltar: pontos, prêmios, avaliações no Google e posts no Instagram.',
  },
  twitter: { card: 'summary_large_image' },
  appleWebApp: { capable: true, title: 'Fidelize', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <RegisterSW />
        <NoAutofill />
        {children}
      </body>
    </html>
  );
}
