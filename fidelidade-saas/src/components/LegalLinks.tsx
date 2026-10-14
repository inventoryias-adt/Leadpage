import Link from 'next/link';
import { TERMS_HREF, TERMS_TITLE, type TermsKind } from '@/lib/legal';

/** Rodapé discreto com os documentos legais. `audience` mostra só o termo de quem está na tela (padrão: os dois). */
export function LegalLinks({ className = '', audience }: { className?: string; audience?: TermsKind }) {
  const kinds: TermsKind[] = audience ? [audience] : ['estabelecimento', 'cliente'];
  return (
    <p className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs text-slate-500 ${className}`}>
      {kinds.map((k) => (
        <Link key={k} href={TERMS_HREF[k]} className="link-inline !font-medium">{audience ? 'Termos de Uso' : TERMS_TITLE[k]}</Link>
      ))}
      <Link href="/privacidade" className="link-inline !font-medium">Política de Privacidade</Link>
    </p>
  );
}
