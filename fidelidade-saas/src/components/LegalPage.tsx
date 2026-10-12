import Link from 'next/link';
import { Brand } from './Brand';
import { SupportLinks } from './SupportLinks';
import { TERMS_UPDATED_LABEL } from '@/lib/legal';
import { getSupport, supportEmail } from '@/lib/support-env';

/** Quem opera o serviço: só mostra os dados de empresa quando estão configurados (LEGAL_NAME, LEGAL_CNPJ). */
export function operatorLine(): string {
  const name = (process.env.LEGAL_NAME ?? '').trim();
  const cnpj = (process.env.LEGAL_CNPJ ?? '').trim();
  if (!name) return 'o Fidelize';
  return `${name}${cnpj ? `, CNPJ ${cnpj}` : ''} (“Fidelize”)`;
}

export function SupportContactLine() {
  const email = supportEmail();
  const support = getSupport('Fidelize: dúvida ou solicitação', 'Olá! Escrevo sobre o Fidelize: ');
  return (
    <p>
      {email ? (
        <>
          E-mail: <a className="link-inline" href={`mailto:${email}`}>{email}</a>.{' '}
        </>
      ) : null}
      <SupportLinks support={email ? { ...support, emailHref: null } : support} lead={email ? 'Também pelo' : 'Fale com a gente:'} />
    </p>
  );
}

/** Moldura das páginas legais (Termos e Privacidade). */
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
      <Brand href="/" />
      <h1 className="mt-8 text-3xl font-extrabold tracking-tight text-primary">{title}</h1>
      <p className="mt-1 text-sm text-slate-500">Última atualização: {TERMS_UPDATED_LABEL}</p>
      <article className="legal mt-8 space-y-5 text-[15px] leading-relaxed text-slate-700 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-primary [&_li]:mt-1.5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6">
        {children}
      </article>
      <nav aria-label="Documentos" className="mt-12 flex flex-wrap gap-x-5 gap-y-2 border-t border-[#E5E7EB] pt-6 text-sm font-semibold">
        <Link href="/termos" className="link-inline">Termos de Uso</Link>
        <Link href="/privacidade" className="link-inline">Política de Privacidade</Link>
        <Link href="/" className="link-inline">Voltar ao início</Link>
      </nav>
    </main>
  );
}
