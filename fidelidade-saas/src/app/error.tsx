'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { LogoMark } from '@/components/Brand';

/** Falha inesperada numa página: mensagem humana, nova tentativa e o código para o suporte achar o erro no registro. */
export default function ErroDaPagina({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(JSON.stringify({ level: 'error', event: 'erro_no_navegador', mensagem: error.message, digest: error.digest }));
  }, [error]);
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="glass-panel w-full max-w-md space-y-4 p-8 text-center">
        <div className="flex justify-center"><LogoMark size={56} /></div>
        <h1 className="text-2xl font-extrabold tracking-tight text-primary">Algo deu errado por aqui</h1>
        <p className="text-sm text-slate-600">Não foi culpa sua. Tente de novo; se continuar, fale com o suporte e informe o código abaixo.</p>
        {error.digest && <p className="rounded-md bg-slate-100 px-3 py-2 font-mono text-xs text-slate-600">Código: {error.digest}</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={reset} className="glass-button">Tentar de novo</button>
          <Link href="/" className="glass-button-ghost">Ir para o início</Link>
        </div>
      </div>
    </main>
  );
}
