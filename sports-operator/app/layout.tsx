import type { Metadata, Viewport } from 'next';
import './globals.css';
import PwaRegister from '../components/PwaRegister';

export const metadata: Metadata = {
  title: 'Sports Operator',
  description: 'Operador pessoal de análise esportiva — futebol',
  manifest: '/manifest.json',
  icons: { icon: '/icon.svg', apple: '/icon.svg' }
};

export const viewport: Viewport = {
  themeColor: '#0b0f14',
  width: 'device-width',
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-bg text-slate-100 antialiased">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
