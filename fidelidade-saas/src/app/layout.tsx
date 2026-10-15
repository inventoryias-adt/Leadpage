import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { NoAutofill } from '@/components/NoAutofill';
import { RegisterSW } from '@/components/RegisterSW';
import { Splash } from '@/components/Splash';
import { SPLASH_GATE } from '@/lib/splash-gate';
import '@fontsource-variable/inter';
import '@fontsource-variable/dm-sans';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Fidelize — Clube de pontos para o seu comércio', template: '%s · Fidelize' },
  description:
    'Clube de pontos para comércios: o cliente volta, gasta mais e indica amigos. Lance pontos pelo CPF ou QR Code, sem app para baixar.',
  applicationName: 'Fidelize',
  metadataBase: new URL(process.env.APP_URL ?? 'https://fidelize-nu.vercel.app'),
  icons: {
    // O número depois do "?v=" faz o navegador (e o Google) baixarem o ícone de novo: some junto com o ícone antigo.
    icon: [
      { url: '/favicon.ico?v=5', sizes: '48x48', type: 'image/x-icon' },
      { url: '/icon-48.png?v=5', sizes: '48x48', type: 'image/png' },
      { url: '/icon-96.png?v=5', sizes: '96x96', type: 'image/png' },
      { url: '/icon-192.png?v=5', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png?v=5', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    type: 'website',
    siteName: 'Fidelize',
    locale: 'pt_BR',
    title: 'Fidelize — Clube de pontos para o seu comércio',
    description: 'Faça seus clientes voltarem: pontos, prêmios, campanhas e agenda para o seu comércio.',
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
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        {/* O Chrome dispara o convite de instalação cedo, antes do React carregar: guarda o evento para o botão usar. */}
        <Script id="fz-install-capture" strategy="beforeInteractive">{`window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__fzInstall=e;});`}</Script>
        <Script id="fz-splash-gate" strategy="beforeInteractive">{SPLASH_GATE}</Script>
        {/* Sem JavaScript as entradas por rolagem não disparam: mostra tudo direto. */}
        <noscript><style>{'.rv{opacity:1!important;transform:none!important}.splash{display:none!important}'}</style></noscript>
        <Splash />
        <RegisterSW />
        <NoAutofill />
        {children}
      </body>
    </html>
  );
}
