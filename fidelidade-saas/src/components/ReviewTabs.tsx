import Link from 'next/link';

/** Abas da área "Avaliações" do painel: nota dos atendimentos e indicações (fotos) dos clientes. Cada uma tem a sua nota, sem misturar. */
export function ReviewTabs({ active, services, posts }: { active: 'servicos' | 'indicacoes'; services: number; posts: number }) {
  const tab = (key: 'servicos' | 'indicacoes', href: string, label: string, n: number) => (
    <Link href={href} aria-current={active === key ? 'page' : undefined} className={`chip-link shrink-0 ${active === key ? 'chip-link-active' : ''}`} data-testid={`tab-${key}`}>
      {label} <span className="opacity-70">· {n}</span>
    </Link>
  );
  return (
    <nav aria-label="Tipo de avaliação" className="chip-row">
      {tab('servicos', '/dashboard/avaliacoes', 'Atendimentos', services)}
      {tab('indicacoes', '/dashboard/indicacoes', 'Indicações (fotos)', posts)}
    </nav>
  );
}
