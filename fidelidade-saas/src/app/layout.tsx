import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { NoAutofill } from '@/components/NoAutofill';
import { RegisterSW } from '@/components/RegisterSW';
import '@fontsource-variable/inter';
import '@fontsource-variable/dm-sans';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Fidelize — Programa de pontos para o seu negócio', template: '%s · Fidelize' },
  description:
    'Programa de pontos e prêmios para restaurantes, lojas, salões e qualquer estabelecimento: faça o cliente voltar, receba mais avaliações no Google e posts no Instagram.',
  applicationName: 'Fidelize',
  metadataBase: new URL(process.env.APP_URL ?? 'https://fidelize-nu.vercel.app'),
  icons: {
    icon: [
      { url: '/icon-48.png?v=2', sizes: '48x48', type: 'image/png' },
      { url: '/icon-96.png?v=2', sizes: '96x96', type: 'image/png' },
      { url: '/icon-192.png?v=2', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png?v=2', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    type: 'website',
    siteName: 'Fidelize',
    locale: 'pt_BR',
    title: 'Fidelize — Programa de pontos para o seu negócio',
    description: 'Faça seus clientes voltarem: pontos, prêmios e avaliações no Google, para qualquer estabelecimento.',
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
        {/* O Chrome dispara o convite de instalação cedo, antes do React carregar: guarda o evento para o botão usar. */}
        <Script id="fz-install-capture" strategy="beforeInteractive">{`window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__fzInstall=e;});`}</Script>
        <RegisterSW />
        <NoAutofill />
        {children}
      </body>
    </html>
  );
}
