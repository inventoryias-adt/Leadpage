import Link from 'next/link';
import { LogoMark } from '@/components/Brand';

export const metadata = { title: 'Página não encontrada' };

export default function NaoEncontrada() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="glass-panel w-full max-w-md space-y-4 p-8 text-center">
        <div className="flex justify-center"><LogoMark size={56} /></div>
        <h1 className="text-2xl font-extrabold tracking-tight text-primary">Página não encontrada</h1>
        <p className="text-sm text-slate-600">O endereço pode ter mudado ou o lugar não está mais ativo.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Link href="/lugares" className="glass-button">Ver lugares</Link>
          <Link href="/" className="glass-button-ghost">Ir para o início</Link>
        </div>
      </div>
    </main>
  );
}
