import { GESTOR_METADATA } from '@/lib/gestor-app';

export const metadata = GESTOR_METADATA;

/** Telas de entrada do gestor: quem instala o app daqui recebe o app do gestor (e não o do cliente). */
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
