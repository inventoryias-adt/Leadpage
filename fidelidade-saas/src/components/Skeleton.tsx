/** Esqueleto exibido instantaneamente enquanto a página carrega (a troca de tela responde na hora). */
export function Block({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-slate-300/40 ${className}`} />;
}

export function PageSkeleton({ narrow = false }: { narrow?: boolean }) {
  return (
    <div
      className={`mx-auto w-full space-y-4 ${narrow ? 'max-w-md p-4 sm:p-6' : 'max-w-3xl'}`}
      role="status"
      aria-live="polite"
      aria-label="Carregando"
    >
      <Block className="h-24" />
      <Block className="h-40" />
      <Block className="h-28" />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
