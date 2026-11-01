import Link from 'next/link';
import { markRedemptionUsed } from '@/app/actions/restaurant';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icons';
import { SubmitButton } from '@/components/ui';
import { maskCpf } from '@/lib/br';
import { prisma } from '@/lib/db';
import { formatBRL, formatPoints } from '@/lib/points';
import { PRESETS, PRESET_LABEL, buildWhere, filterQuery, parseFilter, presetRange, type RedemptionStatusTab } from '@/lib/redemption-filters';
import { requireActiveRestaurant } from '@/lib/session';

export const metadata = { title: 'Resgates' };
export const dynamic = 'force-dynamic';

const PAGE = 25;
const when = (d: Date) => d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
const TABS: [RedemptionStatusTab, string][] = [['pendentes', 'Para entregar'], ['entregues', 'Entregues'], ['todos', 'Todos']];

export default async function ResgatesPage({ searchParams }: { searchParams: Promise<{ st?: string; q?: string; de?: string; ate?: string; periodo?: string; unid?: string; pg?: string; codigo?: string }> }) {
  const restaurant = await requireActiveRestaurant();
  const sp = await searchParams;
  const f = parseFilter(sp);
  const page = Math.max(1, Math.floor(Number(sp.pg) || 1));
  const where = buildWhere(restaurant.id, f);
  // "Validar código do prêmio": o cliente mostra o código, o caixa confere e entrega com um toque.
  const codigo = (sp.codigo ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  const checked = codigo ? await prisma.redemption.findFirst({ where: { restaurantId: restaurant.id, code: codigo }, include: { customer: { select: { name: true } } } }) : null;

  const [rows, total, sums, nPending, nUsed, units] = await Promise.all([
    prisma.redemption.findMany({
      where,
      orderBy: f.st === 'entregues' ? [{ usedAt: 'desc' }, { createdAt: 'desc' }] : f.st === 'pendentes' ? { createdAt: 'asc' } : { createdAt: 'desc' },
      skip: (page - 1) * PAGE,
      take: PAGE,
      include: { customer: { select: { id: true, name: true, cpf: true } }, usedUnit: { select: { name: true } } },
    }),
    prisma.redemption.count({ where }),
    prisma.redemption.aggregate({ where, _sum: { pointsCost: true, cashCents: true } }),
    prisma.redemption.count({ where: { restaurantId: restaurant.id, status: 'PENDING' } }),
    prisma.redemption.count({ where: { restaurantId: restaurant.id, status: 'USED' } }),
    prisma.unit.findMany({ where: { restaurantId: restaurant.id }, select: { id: true, name: true }, orderBy: { createdAt: 'asc' } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const filtered = !!(f.q || f.de || f.ate || f.unid);
  const link = (extra: Record<string, string | null>) => `/dashboard/resgates${filterQuery(f, extra)}`;
  const exportHref = `/dashboard/resgates/exportar${filterQuery(f)}`;
  const counts: Record<RedemptionStatusTab, number> = { pendentes: nPending, entregues: nUsed, todos: nPending + nUsed };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-primary">Resgates</h1>
          <p className="text-sm text-slate-600">Confira o código mostrado pelo cliente, entregue o prêmio e consulte o histórico.</p>
        </div>
        <a href={exportHref} className="glass-button-navy btn-sm" download data-testid="export-resgates"><Icon name="receipt" size={16} /> Exportar planilha (CSV)</a>
      </header>

      <section aria-labelledby="validar" className="glass-panel space-y-3 !rounded-[22px] p-4 sm:p-5" data-testid="validar-codigo">
        <h2 id="validar" className="font-bold text-primary">Validar código do prêmio</h2>
        <form method="get" action="/dashboard/resgates" autoComplete="off" className="flex gap-2" role="search">
          <input name="codigo" defaultValue={codigo} autoComplete="off" maxLength={12} className="glass-input !font-mono !text-xl !font-bold !uppercase !tracking-[0.2em]" placeholder="K7M4QX" aria-label="Código do prêmio" />
          <button className="glass-button-navy !w-auto">Validar</button>
        </form>
        {codigo && !checked && (
          <p role="alert" className="flex items-center gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700" data-testid="codigo-invalido">Código não encontrado neste estabelecimento. Confira com o cliente.</p>
        )}
        {checked && (
          <div className={`space-y-3 rounded-2xl px-4 py-3 ${checked.status === 'PENDING' ? 'bg-emerald-50' : 'bg-slate-100'}`} data-testid="codigo-valido">
            <p className={`flex items-start gap-2 text-sm font-bold ${checked.status === 'PENDING' ? 'text-emerald-700' : 'text-slate-600'}`}>
              <Icon name="check" size={20} className="mt-px shrink-0" />
              <span>
                {checked.status === 'PENDING' ? 'Válido' : checked.status === 'USED' ? 'Já entregue' : 'Código sem validade'} · <span className="text-primary">{checked.customer.name}</span> · {checked.rewardName} · {formatPoints(checked.pointsCost)} pts
                {checked.cashCents > 0 && checked.status === 'PENDING' && <span className="block font-semibold text-primary">Cobrar {formatBRL(checked.cashCents)} no balcão</span>}
                {checked.status === 'USED' && checked.usedAt && <span className="block font-medium">Entregue em {when(checked.usedAt)}</span>}
              </span>
            </p>
            {checked.status === 'PENDING' && (
              <form action={markRedemptionUsed} autoComplete="off">
                <input type="hidden" name="id" value={checked.id} />
                <SubmitButton variant="lime" pendingText="Entregando…">Entregar prêmio e dar baixa</SubmitButton>
              </form>
            )}
          </div>
        )}
      </section>

      <nav aria-label="Situação" className="chip-row">
        {TABS.map(([k, label]) => (
          <Link key={k} href={link({ st: k === 'pendentes' ? null : k, pg: null })} aria-current={f.st === k ? 'true' : undefined} className={`chip-link shrink-0 gap-1.5 ${f.st === k ? 'chip-link-active' : ''}`}>
            {label} <span className="text-xs font-bold opacity-70">{counts[k]}</span>
          </Link>
        ))}
      </nav>

      <form method="get" action="/dashboard/resgates" autoComplete="off" role="search" className="glass-panel space-y-3 !rounded-[22px] p-4" aria-label="Filtros">
        {/* Buscar ou escolher datas na aba "Para entregar" (quase sempre vazia) procura no histórico todo, não só nos pendentes */}
        <input type="hidden" name="st" value={f.st === 'pendentes' ? 'todos' : f.st} />
        <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_1fr_1fr]">
          <div>
            <label htmlFor="rq" className="glass-label">Buscar</label>
            <input id="rq" name="q" defaultValue={f.q} autoComplete="off" className="glass-input" placeholder="Cliente, prêmio, código ou CPF" />
          </div>
          <div>
            <label htmlFor="rde" className="glass-label">De</label>
            <input id="rde" name="de" type="date" defaultValue={f.de ?? ''} autoComplete="off" className="glass-input" />
          </div>
          <div>
            <label htmlFor="rate" className="glass-label">Até</label>
            <input id="rate" name="ate" type="date" defaultValue={f.ate ?? ''} autoComplete="off" className="glass-input" />
          </div>
        </div>
        {units.length > 1 && f.st !== 'pendentes' && (
          <div className="sm:max-w-xs">
            <label htmlFor="runid" className="glass-label">Unidade da entrega</label>
            <select id="runid" name="unid" defaultValue={f.unid ?? ''} className="glass-input">
              <option value="">Todas</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button className="glass-button-navy btn-sm">Filtrar</button>
          {filtered && <Link href={link({ q: null, de: null, ate: null, unid: null, pg: null })} className="glass-button-ghost btn-sm">Limpar filtros</Link>}
          <span className="ml-auto flex flex-wrap gap-1.5" aria-label="Períodos rápidos">
            {PRESETS.map((p) => {
              const r = presetRange(p);
              const on = f.de === r.de && f.ate === r.ate;
              return <Link key={p} href={link({ de: r.de, ate: r.ate, pg: null, ...(f.st === 'pendentes' ? { st: 'todos' } : {}) })} aria-current={on ? 'true' : undefined} className={`chip-link ${on ? 'chip-link-active' : ''}`}>{PRESET_LABEL[p]}</Link>;
            })}
          </span>
        </div>
      </form>

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600" data-testid="resgates-resumo">
        <span><b className="text-primary">{total}</b> {total === 1 ? 'resgate' : 'resgates'}</span>
        <span>· {formatPoints(sums._sum.pointsCost ?? 0)} pts usados</span>
        {(sums._sum.cashCents ?? 0) > 0 && <span>· {formatBRL(sums._sum.cashCents ?? 0)} a cobrar no balcão</span>}
        {filtered && <span className="glass-chip">filtrado</span>}
      </p>

      {rows.length === 0 ? (
        <EmptyState
          compact
          variant="gift"
          title={f.st === 'pendentes' && !filtered ? 'Nenhum prêmio para entregar' : 'Nenhum resgate encontrado'}
          text={f.st === 'pendentes' && !filtered ? 'Quando um cliente resgatar, o código aparece aqui para você validar no balcão.' : 'Mude os filtros ou o período para ver outros resgates.'}
        />
      ) : (
        <div className="glass-panel overflow-hidden !rounded-[22px]">
          <div className="hidden grid-cols-[6.5rem_minmax(0,1.6fr)_minmax(0,1.4fr)_9rem_7rem_6.5rem] gap-3 border-b border-slate-100 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 md:grid" aria-hidden>
            <span>Código</span><span>Prêmio</span><span>Cliente</span><span>Quando</span><span>Valor</span><span />
          </div>
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => (
              <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 md:grid-cols-[6.5rem_minmax(0,1.6fr)_minmax(0,1.4fr)_9rem_7rem_6.5rem]" data-testid="resgate-row">
                <p className="font-mono text-base font-bold tracking-[0.2em] text-primary">{r.code}</p>
                <p className="col-span-2 min-w-0 md:col-span-1">
                  <span className="block truncate font-semibold text-slate-800">{r.rewardName}</span>
                  {r.cashCents > 0 && r.status === 'PENDING' && <span className="block text-xs font-bold text-primary">Cobrar {formatBRL(r.cashCents)} no balcão</span>}
                </p>
                <p className="col-span-2 min-w-0 text-sm md:col-span-1">
                  <Link href={`/dashboard/clientes/${r.customer.id}`} className="link-inline !font-medium">{r.customer.name}</Link>
                  <span className="block truncate text-xs text-slate-500">CPF {maskCpf(r.customer.cpf)}</span>
                </p>
                <p className="col-span-2 text-xs text-slate-600 md:col-span-1">
                  {r.status === 'USED' ? <><span className="chip-verde mr-1.5">Entregue</span>{r.usedAt ? when(r.usedAt) : ''}{r.usedUnit ? ` · ${r.usedUnit.name}` : ''}</> : <><span className="glass-chip mr-1.5 !bg-amber-100 !text-amber-800">A entregar</span>{when(r.createdAt)}</>}
                </p>
                <p className="text-sm font-bold text-slate-700">−{formatPoints(r.pointsCost)} pts{r.cashCents > 0 && <span className="block text-xs font-medium text-slate-500">+ {formatBRL(r.cashCents)}</span>}</p>
                <div className="text-right">
                  {r.status === 'PENDING' && (
                    <form action={markRedemptionUsed} autoComplete="off">
                      <input type="hidden" name="id" value={r.id} />
                      <SubmitButton variant="navy" pendingText="…" className="btn-sm">Entregar</SubmitButton>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Páginas" className="flex items-center justify-between gap-3">
          {page > 1 ? <Link href={link({ pg: String(page - 1) })} className="glass-button-ghost btn-sm">← Anteriores</Link> : <span />}
          <span className="text-xs text-slate-500">Página {page} de {pages}</span>
          {page < pages ? <Link href={link({ pg: String(page + 1) })} className="glass-button-ghost btn-sm">Próximos →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
