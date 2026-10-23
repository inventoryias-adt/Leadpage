import Link from 'next/link';
import { CaixaForm } from '@/components/CaixaForm';
import { InteractionRequests } from '@/components/InteractionRequests';
import { settleDueInteractions } from '@/lib/interaction-claims';
import { prisma } from '@/lib/db';
import { maskCpf } from '@/lib/br';
import { SITUACOES, SITUACAO_LABEL, buildClaimWhere, claimQuery, parseClaimFilter } from '@/lib/claim-filters';
import { formatPoints } from '@/lib/points';
import { PRESETS, PRESET_LABEL, presetRange } from '@/lib/redemption-filters';
import { requireActiveRestaurant } from '@/lib/session';
import { Icon } from '@/components/Icons';
import { currentUnit } from '@/lib/units';

export const metadata = { title: 'Caixa' };
export const dynamic = 'force-dynamic';

const PAGE = 15;

export default async function CaixaPage({ searchParams }: { searchParams: Promise<{ q?: string; de?: string; ate?: string; sit?: string; periodo?: string; unid?: string; pg?: string }> }) {
  const restaurant = await requireActiveRestaurant();
  const sp = await searchParams;
  const f = parseClaimFilter(sp);
  const page = Math.max(1, Math.floor(Number(sp.pg) || 1));
  const where = buildClaimWhere(restaurant.id, f);
  await settleDueInteractions({ restaurantId: restaurant.id }).catch(() => 0);
  const [rules, requests, recent, total, credited, { unit, units }, promos] = await Promise.all([
    prisma.interactionRule.findMany({
      where: { restaurantId: restaurant.id, active: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, label: true, points: true },
    }),
    prisma.interactionClaim.findMany({ where: { restaurantId: restaurant.id, status: 'PENDING' }, orderBy: { createdAt: 'asc' }, take: 50, include: { customer: { select: { name: true } } } }),
    prisma.claim.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE,
      take: PAGE,
      include: { customer: { select: { name: true, cpf: true } }, unit: { select: { name: true } } },
    }),
    prisma.claim.count({ where }),
    prisma.claim.aggregate({ where: { AND: [where, { redeemedAt: { not: null } }] }, _sum: { points: true }, _count: true }),
    currentUnit(restaurant.id),
    prisma.promotion.findMany({ where: { restaurantId: restaurant.id, active: true, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] } }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE));
  const filtered = !!(f.q || f.de || f.ate || f.sit !== 'todos' || f.unid);
  const link = (extra: Record<string, string | null>) => `/dashboard/caixa${claimQuery(f, extra)}#lancamentos`;
  const now = Date.now();
  const statusOf = (c: (typeof recent)[number]) =>
    c.redeemedAt ? `Creditado a ${c.customer?.name ?? 'cliente'}${c.customer?.cpf ? ` (CPF ${maskCpf(c.customer.cpf)})` : ''}` : c.expiresAt.getTime() < now ? 'Expirado' : 'Aguardando leitura';

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="space-y-4">
        {units.length > 1 && unit && (
          <p className="glass-inset flex items-center gap-2 px-4 py-3 text-sm text-slate-700">
            <Icon name="pin" size={16} className="text-electric-600" />
            Lançando pela unidade <strong className="text-primary">{unit.name}</strong>
            <span className="text-slate-500">(troque no topo da tela)</span>
          </p>
        )}
        {requests.length > 0 && (
          <div>
            <InteractionRequests items={requests.map((r) => ({ id: r.id, label: r.label, points: r.points, createdAt: r.createdAt, autoAt: r.autoAt, customerName: r.customer.name }))} />
          </div>
        )}
        <CaixaForm
          placeName={restaurant.name}
          pointsPerReal={restaurant.pointsPerReal}
          rules={rules}
          promos={promos.map((p) => ({ ...p, startsAt: p.startsAt?.toISOString() ?? null, endsAt: p.endsAt?.toISOString() ?? null }))}
        />
      </div>

      <section id="lancamentos" className="glass-panel scroll-mt-4 space-y-4 p-5" aria-labelledby="lanc-titulo">
        <h2 id="lanc-titulo" className="font-bold text-primary">Últimos lançamentos</h2>

        <form method="get" action="/dashboard/caixa#lancamentos" autoComplete="off" role="search" aria-label="Buscar lançamentos" className="space-y-3">
          <div>
            <label htmlFor="lq" className="glass-label">Buscar</label>
            <div className="flex gap-2">
              <input id="lq" name="q" defaultValue={f.q} autoComplete="off" className="glass-input" placeholder="Nome, CPF ou valor" />
              <button className="glass-button-navy !w-auto shrink-0 px-6">Buscar</button>
            </div>
          </div>
          <details open={!!(f.de || f.ate || f.sit !== 'todos' || f.unid)} className="group rounded-2xl bg-slate-50/70 px-4 py-3" data-testid="lancamentos-mais-filtros">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-primary">
              Data e situação
              <Icon name="chevron" size={16} className="transition-transform group-open:rotate-90" />
            </summary>
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3 [&>div]:min-w-0">
                <div>
                  <label htmlFor="lde" className="glass-label">De</label>
                  <input id="lde" name="de" type="date" defaultValue={f.de ?? ''} autoComplete="off" className="glass-input" />
                </div>
                <div>
                  <label htmlFor="late" className="glass-label">Até</label>
                  <input id="late" name="ate" type="date" defaultValue={f.ate ?? ''} autoComplete="off" className="glass-input" />
                </div>
              </div>
              <div className={`grid gap-3 [&>div]:min-w-0 ${units.length > 1 ? 'grid-cols-2' : 'grid-cols-1 sm:max-w-xs'}`}>
                <div>
                  <label htmlFor="lsit" className="glass-label">Situação</label>
                  <select id="lsit" name="sit" defaultValue={f.sit} className="glass-input">
                    {SITUACOES.map((k) => <option key={k} value={k}>{SITUACAO_LABEL[k]}</option>)}
                  </select>
                </div>
                {units.length > 1 && (
                  <div>
                    <label htmlFor="lunid" className="glass-label">Unidade</label>
                    <select id="lunid" name="unid" defaultValue={f.unid ?? ''} className="glass-input">
                      <option value="">Todas</option>
                      {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5" aria-label="Períodos rápidos">
                {PRESETS.map((p) => {
                  const r = presetRange(p);
                  const on = f.de === r.de && f.ate === r.ate;
                  return <Link key={p} href={link({ de: r.de, ate: r.ate, pg: null })} aria-current={on ? 'true' : undefined} className={`chip-link ${on ? 'chip-link-active' : ''}`}>{PRESET_LABEL[p]}</Link>;
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button className="glass-button-navy btn-sm">Aplicar filtros</button>
              </div>
            </div>
          </details>
          {filtered && <Link href={link({ q: null, de: null, ate: null, sit: null, unid: null, pg: null })} className="glass-button-ghost btn-sm">Limpar filtros</Link>}
        </form>

        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600" data-testid="lancamentos-resumo">
          <span><b className="text-primary">{total}</b> {total === 1 ? 'lançamento' : 'lançamentos'}</span>
          {credited._count > 0 && <span>· {formatPoints(credited._sum.points ?? 0)} pts creditados</span>}
          {filtered && <span className="glass-chip">filtrado</span>}
        </p>

        {recent.length === 0 ? (
          <p className="text-sm text-slate-500">{filtered ? 'Nenhum lançamento encontrado. Mude a busca ou o período.' : 'Nada por aqui ainda.'}</p>
        ) : (
          <ul className="divide-y divide-white/60" data-testid="lancamentos-lista">
            {recent.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800">{c.description}</p>
                  <p className="text-xs text-slate-500">
                    {c.createdAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })} · {statusOf(c)}{units.length > 1 && c.unit ? ` · ${c.unit.name}` : ''}
                  </p>
                </div>
                <span className="shrink-0 font-bold text-electric-600">{formatPoints(c.points)} pts</span>
              </li>
            ))}
          </ul>
        )}

        {pages > 1 && (
          <nav aria-label="Páginas dos lançamentos" className="flex items-center justify-between gap-3">
            {page > 1 ? <Link href={link({ pg: String(page - 1) })} className="glass-button-ghost btn-sm">← Anteriores</Link> : <span />}
            <span className="text-xs text-slate-500">Página {page} de {pages}</span>
            {page < pages ? <Link href={link({ pg: String(page + 1) })} className="glass-button-ghost btn-sm">Próximos →</Link> : <span />}
          </nav>
        )}
      </section>
    </div>
  );
}
