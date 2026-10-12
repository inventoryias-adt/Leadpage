import Link from 'next/link';

/** Rodapé discreto com os documentos legais. */
export function LegalLinks({ className = '' }: { className?: string }) {
  return (
    <p className={`text-center text-xs text-slate-500 ${className}`}>
      <Link href="/termos" className="link-inline !font-medium">Termos de Uso</Link>
      {' · '}
      <Link href="/privacidade" className="link-inline !font-medium">Política de Privacidade</Link>
    </p>
  );
}
