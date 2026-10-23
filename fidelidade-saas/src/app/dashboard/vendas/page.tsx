import Link from 'next/link';
import { SalesArea } from '@/components/DashboardCharts';
import { DayList } from '@/components/DashboardFocus';
import { EmptyState } from '@/components/EmptyState';
import { prisma } from '@/lib/db';
import { dailySeries, deltaPct, WEEKDAYS } from '@/lib/insights';
import { formatBRL, formatPoints } from '@/lib/points';
import { requireActiveRestaurant } from '@/lib/session';

export const metadata = { title: 'Vendas por dia' };
export const dynamic = 'force-dynamic';

const PERIODS = [7, 30, 90] as const;
const DAY = 24 * 60 * 60 * 1000;

/** Tela cheia do gráfico "Vendas por dia": só os dados de vendas, com o dia a dia em lista. Tocar num dia abre o detalhe. */
export default async function VendasPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const restaurant = await requireActiveRestaurant();
  const requested = Number((await searchParams).dias);
  const days = (PERIODS as readonly number[]).includes(requested) ? requested : 30;
  const now = new Date();
  const since = new Date(now.getTime() - days * DAY);
  const prevSince = new Date(since.getTime() - days * DAY);

  const sales = await prisma.claim.findMany({
    where: { restaurantId: restaurant.id, redeemedAt: { gte: prevSince }, amountCents: { gt: 0 } },
    select: { redeemedAt: true, amountCents: true, points: true },
    take: 40000,
  });
  const cur = sales.filter((s) => s.redeemedAt && s.redeemedAt >= since);
  const prev = sales.filter((s) => s.redeemedAt && s.redeemedAt < since);
  const series = dailySeries(cur.map((s) => ({ at: s.redeemedAt as Date, cents: s.amountCents, points: s.points })), days, now);
  const revenue = cur.reduce((n, s) => n + s.amountCents, 0);
  const revenuePrev = prev.reduce((n, s) => n + s.amountCents, 0);
  const best = series.reduce((b, d) => (d.cents > b.cents ? d : b), series[0]);
  const rows = [...series].reverse().map((d) => ({ ymd: d.ymd, label: d.label, weekday: WEEKDAYS[new Date(`${d.ymd}T12:00:00Z`).getUTCDay()], count: d.count, cents: d.cents }));
  const delta = deltaPct(revenue, revenuePrev);

  return (
    <div className="mx-auto max-w-3xl min-w-0 space-y-5">
      <header className="space-y-1">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm font-semibold text-electric-600">‹ Painel</Link>
        <h1 className="text-2xl font-extrabold tracking-tight text-primary">Vendas por dia</h1>
        <p className="text-sm text-slate-600">Soma das compras lançadas no caixa e lidas pelos clientes. Toque num dia para ver o que aconteceu.</p>
      </header>

      <nav aria-label="Período" className="flex gap-1.5">
        {PERIODS.map((p) => (
          <Link key={p} href={`/dashboard/vendas?dias=${p}`} aria-current={p === days ? 'true' : undefined} className={`chip-link ${p === days ? 'chip-link-active' : ''}`}>{p} dias</Link>
        ))}
      </nav>

      {cur.length === 0 ? (
        <EmptyState compact variant="chart" title="Sem compras neste período" text="Quando houver lançamentos, as vendas de cada dia aparecem aqui." />
      ) : (
        <>
          <section aria-label="Resumo" className="grid grid-cols-3 gap-2" data-testid="vendas-resumo">
            <div className="rounded-2xl bg-white px-3 py-3 shadow-sm ring-1 ring-slate-200/70">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Vendas</p>
              <p className="text-lg font-extrabold leading-tight text-primary tabular-nums">{formatBRL(revenue)}</p>
              {delta != null && <p className={`text-[11px] font-bold ${delta >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{delta >= 0 ? '+' : '−'}{Math.abs(delta)}% vs. período anterior</p>}
            </div>
            <div className="rounded-2xl bg-white px-3 py-3 shadow-sm ring-1 ring-slate-200/70">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Compras</p>
              <p className="text-lg font-extrabold leading-tight text-primary tabular-nums">{cur.length}</p>
              <p className="text-[11px] text-slate-500">ticket {formatBRL(cur.length ? Math.round(revenue / cur.length) : 0)}</p>
            </div>
            <div className="rounded-2xl bg-white px-3 py-3 shadow-sm ring-1 ring-slate-200/70">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Melhor dia</p>
              <p className="text-lg font-extrabold leading-tight text-primary tabular-nums">{best && best.cents > 0 ? best.label : '—'}</p>
              <p className="text-[11px] text-slate-500">{best && best.cents > 0 ? `${formatBRL(best.cents)} · ${formatPoints(best.points)} pts` : ''}</p>
            </div>
          </section>

          <section className="glass-panel min-w-0 p-4 sm:p-5" aria-label="Gráfico">
            <SalesArea days={series} />
          </section>

          <section aria-labelledby="dia-a-dia">
            <h2 id="dia-a-dia" className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Dia a dia</h2>
            <DayList rows={rows} />
          </section>
        </>
      )}
    </div>
  );
}
