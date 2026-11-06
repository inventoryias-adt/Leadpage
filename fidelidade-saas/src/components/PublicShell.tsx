import Link from 'next/link';
import type { ReactNode } from 'react';
import { Brand } from './Brand';
import { Icon, type IconName } from './Icons';
import { Reveal } from './Reveal';
import { SignupLink } from './SignupLink';

/** Páginas do menu público, na ordem em que aparecem. */
export const PUBLIC_LINKS = [
  { href: '/pontos', label: 'Pontos' },
  { href: '/desafios', label: 'Desafios' },
  { href: '/instagram', label: 'Instagram' },
  { href: '/precos', label: 'Preços' },
] as const;

export { SignupLink };

/** Menu do site público: marca, uma página por recurso, entrar e começar. */
export function PublicNav({ current, dark }: { current?: string; dark?: boolean }) {
  return (
    <header data-testid="public-nav" className={dark ? 'bg-primary text-white' : 'bg-white text-primary'}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4 sm:px-8">
        <Brand light={dark} />
        <nav aria-label="Páginas do site" className="hidden items-center gap-1 text-sm font-semibold md:flex">
          {PUBLIC_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={current === l.href ? 'page' : undefined}
              className={`rounded-full px-4 py-2 transition-colors ${current === l.href ? (dark ? 'bg-white/15 text-white' : 'bg-[#F1F3F6] text-primary') : dark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-primary'}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Link href="/login" className={`rounded-full px-3 py-2 ${dark ? 'text-slate-200 hover:text-white' : 'text-slate-600 hover:text-primary'}`}>Entrar</Link>
          <SignupLink className={`${dark ? 'glass-button-light' : 'glass-button-primary'} btn-sm !w-auto`}>Começar</SignupLink>
        </div>
      </div>
      {/* No celular o menu vira uma fileira que rola para o lado. */}
      <nav aria-label="Páginas do site" className="flex gap-1 overflow-x-auto px-4 pb-3 text-sm font-semibold md:hidden">
        {PUBLIC_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={current === l.href ? 'page' : undefined}
            className={`shrink-0 rounded-full px-4 py-1.5 ${current === l.href ? (dark ? 'bg-white/15 text-white' : 'bg-[#F1F3F6] text-primary') : dark ? 'text-slate-300' : 'text-slate-600'}`}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-[#E5E7EB] bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-5 py-10 text-center text-sm text-slate-500">
        <Brand />
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 font-semibold text-primary">
          {PUBLIC_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-electric-600">{l.label}</Link>
          ))}
          <Link href="/entrar" className="hover:text-electric-600">Sou cliente</Link>
          <Link href="/login" className="hover:text-electric-600">Entrar</Link>
        </div>
        <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <Link href="/termos/estabelecimento" className="hover:text-electric-600">Termos para Estabelecimentos</Link>
          <Link href="/termos/cliente" className="hover:text-electric-600">Termos do Cliente</Link>
          <Link href="/privacidade" className="hover:text-electric-600">Política de Privacidade</Link>
        </p>
        <p>© {new Date().getFullYear()} Fidelize. Todos os direitos reservados.</p>
      </div>
    </footer>
  );
}

/** Faixa escura do topo de cada página de recurso: voltar, ícone, título e uma frase. */
export function PageHero({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <section className="bg-primary text-white">
      <div className="mx-auto max-w-6xl px-5 pb-12 pt-4 sm:px-8 sm:pb-16">
        <Link href="/" className="back-link !text-slate-300 hover:!text-white">
          <Icon name="back" size={14} /> Voltar ao início
        </Link>
        <div className="mt-6 flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-verde"><Icon name={icon} size={28} /></span>
          <h1 data-h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">{title}</h1>
        </div>
        <p className="mt-4 max-w-2xl text-lg text-slate-300">{text}</p>
      </div>
    </section>
  );
}

/** Uma seção de recurso: texto e benefícios de um lado, maquete do app do outro. */
export function FeatureSplit({
  chip,
  title,
  accent,
  text,
  items,
  cta,
  mock,
  reverse,
  tone = 'light',
}: {
  chip: string;
  title: string;
  accent: string;
  text: string;
  items: { icon: IconName; title: string; text: string }[];
  cta: string;
  mock: ReactNode;
  reverse?: boolean;
  tone?: 'light' | 'gray';
}) {
  return (
    <section className={tone === 'gray' ? 'bg-[#F6F7F9]' : 'bg-white'}>
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-14 sm:px-8 md:grid-cols-2 md:gap-14 md:py-20">
        <Reveal from={reverse ? 'right' : 'left'} className={reverse ? 'md:order-2' : ''}>
          <span className="glass-chip mb-4">{chip}</span>
          <h2 className="mb-4 text-3xl font-extrabold leading-tight tracking-tight text-primary md:text-4xl">
            {title} <span className="text-electric-500">{accent}</span>
          </h2>
          <p className="mb-6 text-slate-600">{text}</p>
          <ul className="mb-7 space-y-3">
            {items.map((it) => (
              <li key={it.title} className="flex items-center gap-4 rounded-2xl border border-[#E5E7EB] bg-white p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-electric-500/10 text-electric-600"><Icon name={it.icon} size={20} /></span>
                <span className="min-w-0">
                  <span className="block font-semibold text-primary">{it.title}</span>
                  <span className="block text-sm text-slate-500">{it.text}</span>
                </span>
              </li>
            ))}
          </ul>
          <SignupLink className="glass-button !w-auto">
            {cta}
            <Icon name="chevron" size={16} />
          </SignupLink>
        </Reveal>
        <Reveal from={reverse ? 'left' : 'right'} className={reverse ? 'md:order-1' : ''}>{mock}</Reveal>
      </div>
    </section>
  );
}

/** Faixa de fechamento: chamada para começar. */
export function ClosingBand({ title, text }: { title: string; text: string }) {
  return (
    <section className="bg-dots-dark relative overflow-hidden bg-primary px-5 py-16 text-center sm:px-8">
      <h2 className="mx-auto mb-3 max-w-2xl text-3xl font-extrabold tracking-tight text-white md:text-4xl">{title}</h2>
      <p className="mx-auto mb-7 max-w-xl text-slate-300">{text}</p>
      <SignupLink className="glass-button-light !w-auto">Quero fidelizar meus clientes</SignupLink>
    </section>
  );
}
