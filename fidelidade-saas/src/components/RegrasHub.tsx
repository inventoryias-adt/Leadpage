import Link from 'next/link';
import type { Hub, HubItem, HubStatus } from '@/lib/regras-hub';
import { Icon } from './Icons';

const CHIP: Record<HubStatus, [string, string]> = {
  ok: ['Pronto', 'bg-emerald-100 text-emerald-700'],
  todo: ['Falta fazer', 'bg-amber-100 text-amber-800'],
  on: ['Ligado', 'bg-[#E8EEFB] text-electric-600'],
  off: ['Desligado', 'bg-slate-100 text-slate-600'],
  opt: ['Opcional', 'bg-slate-100 text-slate-500'],
};

function Row({ x }: { x: HubItem }) {
  const [label, cls] = CHIP[x.status];
  return (
    <li>
      <Link href={x.href} data-testid={`hub-${x.id}`} className="card-link flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5">
        <span aria-hidden className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${x.status === 'todo' ? 'bg-amber-50 text-amber-700' : 'bg-[#E8EEFB] text-electric-600'}`}><Icon name={x.icon} size={20} /></span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="font-bold leading-snug text-slate-800">{x.title}</span>
            <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold ${cls}`} data-testid={`hub-${x.id}-status`}>{label}</span>
          </span>
          <span className="mt-0.5 block text-sm leading-snug text-slate-500 [overflow-wrap:anywhere]">{x.summary}</span>
        </span>
        <Icon name="chevron" size={16} className="shrink-0 text-slate-300" />
      </Link>
    </li>
  );
}

/** Tela inicial de Regras: o que já está pronto, o que falta e um cartão por assunto. */
export function RegrasHub({ hub, placeName, placeHref }: { hub: Hub; placeName: string; placeHref: string }) {
  const { done, total } = hub.essentials;
  const pct = Math.round((done / total) * 100);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-primary">Regras do clube</h1>
        <p className="text-sm text-slate-600">Tudo o que o cliente vê no app de {placeName} nasce aqui. Toque num assunto para ajustar.</p>
      </header>

      <section aria-labelledby="pronto" className="glass-panel space-y-3 !rounded-[22px] p-4 sm:p-5" data-testid="hub-progress">
        <div className="flex items-center justify-between gap-3">
          <h2 id="pronto" className="font-bold text-primary">{done === total ? 'Seu clube está pronto para o cliente' : 'Falta pouco para o clube ficar pronto'}</h2>
          <span className="shrink-0 rounded-full bg-[#E8EEFB] px-3 py-1 text-xs font-bold text-electric-600" data-testid="hub-count">{done} de {total}</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total} aria-label="Itens essenciais prontos">
          <div className="h-full rounded-full bg-lima transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hub.next ? (
            <Link href={hub.next.href} className="glass-button-lime btn-sm !w-auto" data-testid="hub-next">Próximo passo: {hub.next.title} →</Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700"><Icon name="check" size={16} /> Tudo o que é essencial está pronto.</span>
          )}
          <a href={placeHref} target="_blank" rel="noopener noreferrer" className="glass-button-ghost btn-sm !w-auto" data-testid="hub-preview">Ver como o cliente vê</a>
        </div>
      </section>

      {hub.ideas.length > 0 && (
        <section aria-labelledby="ideias" className="rounded-2xl border border-[#d9e1f2] bg-[#f3f6fd] p-4" data-testid="hub-ideas">
          <h2 id="ideias" className="mb-1.5 flex items-center gap-2 text-sm font-bold text-primary"><Icon name="spark" size={16} className="text-electric-600" /> Ideias para o cliente voltar mais</h2>
          <ul className="space-y-1 text-sm text-slate-700">{hub.ideas.map((t) => <li key={t}>{t}</li>)}</ul>
        </section>
      )}

      {hub.groups.map((g) => (
        <section key={g.id} aria-labelledby={`g-${g.id}`}>
          <h2 id={`g-${g.id}`} className="text-base font-bold text-slate-800">{g.title}</h2>
          <p className="mb-2.5 text-sm text-slate-500">{g.hint}</p>
          <ul className="space-y-2.5">{g.items.map((x) => <Row key={x.id} x={x} />)}</ul>
        </section>
      ))}

      <p className="text-center text-xs text-slate-500">
        Prefere ver tudo em uma página só? <Link href="/dashboard/configuracoes?abrir=tudo" className="link-inline">Abrir todas as regras</Link>
      </p>
    </div>
  );
}
