import type { Metadata, Viewport } from 'next';
import { RegisterSW } from '@/components/RegisterSW';
import '@fontsource-variable/inter';
import '@fontsource-variable/dm-sans';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Fidelize — Programa de pontos para restaurantes', template: '%s · Fidelize' },
  description:
    'Sistema de recompensas por pontos para restaurantes: faça o cliente voltar, receba mais avaliações no Google e posts no Instagram.',
  applicationName: 'Fidelize',
  icons: { apple: '/apple-touch-icon.png' },
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
        {children}
      </body>
    </html>
  );
}
