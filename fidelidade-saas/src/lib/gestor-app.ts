import type { Metadata } from 'next';

/** Metadados do app do gestor: manifesto, nome e ícone próprios (para "Adicionar à tela inicial" abrir o painel, não o app do cliente). */
export const GESTOR_METADATA: Pick<Metadata, 'manifest' | 'applicationName' | 'appleWebApp' | 'icons'> = {
  manifest: '/gestor.webmanifest',
  applicationName: 'Fidelize Gestor',
  appleWebApp: { capable: true, title: 'Fidelize Gestor', statusBarStyle: 'black-translucent' },
  icons: {
    icon: [
      { url: '/favicon.ico?v=5', sizes: '48x48', type: 'image/x-icon' },
      { url: '/gestor-icon-96.png?v=1', sizes: '96x96', type: 'image/png' },
      { url: '/gestor-icon-192.png?v=1', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/gestor-apple-touch-icon.png?v=1', sizes: '180x180', type: 'image/png' }],
  },
};
