import Link from 'next/link';
import { PeakGridFull, TopSlots } from '@/components/DashboardFocus';
import { EmptyState } from '@/components/EmptyState';
import { prisma } from '@/lib/db';
import { heatmap, peakSlot, WEEKDAYS } from '@/lib/insights';
import { requireActiveRestaurant } from '@/lib/session';

export const metadata = { title: 'Dias e horários de pico' };
export const dynamic = 'force-dynamic';

const DAY = 24 * 60 * 60 * 1000;

/** Tela cheia do mapa de horários: dias da semana × horas em células grandes, com os melhores horários em lista. */
export default async function HorariosPage() {
  const restaurant = await requireActiveRestaurant();
  const sales = await prisma.claim.findMany({
    where: { restaurantId: restaurant.id, redeemedAt: { gte: new Date(Date.now() - 90 * DAY) }, amountCents: { gt: 0 } },
    select: { redeemedAt: true },
    take: 40000,
  });
  const grid = heatmap(sales.map((s) => ({ at: s.redeemedAt as Date })));
  const peak = peakSlot(grid);
  const cells = grid.flatMap((row, dow) => row.map((count, hour) => ({ dow, hour, count }))).filter((c) => c.count > 0);
  const top = [...cells].sort((a, b) => b.count - a.count || a.hour - b.hour).slice(0, 5);
  // Só as horas em que há movimento (com uma de folga), para as células ficarem grandes e a tela curta.
  const hours = cells.map((c) => c.hour);
  const from = hours.length ? Math.max(0, Math.min(...hours) - 1) : 8;
  const to = hours.length ? Math.min(23, Math.max(...hours) + 1) : 22;

  return (
    <div className="mx-auto max-w-3xl min-w-0 space-y-5">
      <header className="space-y-1">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm font-semibold text-electric-600">‹ Painel</Link>
        <h1 className="text-2xl font-extrabold tracking-tight text-primary">Dias e horários de pico</h1>
        <p className="text-sm text-slate-600">
          {peak ? <>Seu movimento é maior na <strong className="text-slate-800">{WEEKDAYS[peak.dow]}, perto das {peak.hour}h</strong>. Últimos 90 dias. </> : 'Mostra quando os clientes mais compram (últimos 90 dias). '}
          Toque num horário para ver o detalhe.
        </p>
      </header>

      {cells.length === 0 ? (
        <EmptyState compact variant="chart" title="Sem compras nos últimos 90 dias" text="Quando houver lançamentos, os horários de maior movimento aparecem aqui." />
      ) : (
        <>
          <section aria-labelledby="melhores">
            <h2 id="melhores" className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Melhores horários</h2>
            <TopSlots items={top} />
          </section>
          <section aria-labelledby="mapa">
            <h2 id="mapa" className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Mapa da semana</h2>
            <PeakGridFull grid={grid} from={from} to={to} />
          </section>
        </>
      )}
    </div>
  );
}
