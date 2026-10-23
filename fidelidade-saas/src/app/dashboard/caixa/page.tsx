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

        <form method="get" action="/dashboard/caixa#lancamentos" autoComplete="off" role="search" aria-label="Buscar lançamentos" className="space-y-3.5">
          {/* o que não está em campo na tela (situação e unidade escolhidas pelos chips) continua valendo ao buscar */}
          {f.sit !== 'todos' && <input type="hidden" name="sit" value={f.sit} />}
          {f.unid && <input type="hidden" name="unid" value={f.unid} />}

          <div className="relative">
            <Icon name="search" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <label htmlFor="lq" className="sr-only">Buscar</label>
            <input id="lq" name="q" defaultValue={f.q} autoComplete="off" enterKeyHint="search" className="glass-input !rounded-full !py-2.5 !pl-10 !pr-24" placeholder="Nome, CPF ou valor" />
            <button className="glass-button-navy absolute right-1.5 top-1/2 !w-auto -translate-y-1/2 !rounded-full !px-4 !py-1.5 text-sm">Buscar</button>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Período</p>
            <div className="chip-row" aria-label="Períodos rápidos">
              {PRESETS.map((p) => {
                const r = presetRange(p);
                const on = f.de === r.de && f.ate === r.ate;
                return <Link key={p} href={link({ de: r.de, ate: r.ate, pg: null })} aria-current={on ? 'true' : undefined} className={`chip-link shrink-0 !py-1 ${on ? 'chip-link-active' : ''}`}>{PRESET_LABEL[p]}</Link>;
              })}
            </div>
            <details open={!!(f.de || f.ate)} className="group" data-testid="lancamentos-mais-filtros">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-semibold text-electric-600">
                Escolher datas
                <Icon name="chevron" size={13} className="transition-transform group-open:rotate-90" />
              </summary>
              <div className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2">
                <div className="min-w-0">
                  <label htmlFor="lde" className="glass-label">De</label>
                  <input id="lde" name="de" type="date" defaultValue={f.de ?? ''} autoComplete="off" className="glass-input !py-2" />
                </div>
                <div className="min-w-0">
                  <label htmlFor="late" className="glass-label">Até</label>
                  <input id="late" name="ate" type="date" defaultValue={f.ate ?? ''} autoComplete="off" className="glass-input !py-2" />
                </div>
                <button className="glass-button-ghost btn-sm !rounded-full">Aplicar</button>
              </div>
            </details>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Situação</p>
            <div className="chip-row" aria-label="Situação do lançamento">
              {SITUACOES.map((k) => (
                <Link key={k} href={link({ sit: k === 'todos' ? null : k, pg: null })} aria-current={f.sit === k ? 'true' : undefined} className={`chip-link shrink-0 !py-1 ${f.sit === k ? 'chip-link-active' : ''}`}>{SITUACAO_LABEL[k]}</Link>
              ))}
            </div>
          </div>

          {units.length > 1 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Unidade</p>
              <div className="chip-row" aria-label="Unidade">
                <Link href={link({ unid: null, pg: null })} aria-current={!f.unid ? 'true' : undefined} className={`chip-link shrink-0 !py-1 ${!f.unid ? 'chip-link-active' : ''}`}>Todas</Link>
                {units.map((u) => (
                  <Link key={u.id} href={link({ unid: u.id, pg: null })} aria-current={f.unid === u.id ? 'true' : undefined} className={`chip-link shrink-0 !py-1 ${f.unid === u.id ? 'chip-link-active' : ''}`}>{u.name}</Link>
                ))}
              </div>
            </div>
          )}
        </form>

        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600" data-testid="lancamentos-resumo">
          <span><b className="text-primary">{total}</b> {total === 1 ? 'lançamento' : 'lançamentos'}</span>
          {credited._count > 0 && <span>· {formatPoints(credited._sum.points ?? 0)} pts creditados</span>}
          {filtered && <Link href={link({ q: null, de: null, ate: null, sit: null, unid: null, pg: null })} className="font-semibold text-electric-600 hover:underline">Limpar filtros</Link>}
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
