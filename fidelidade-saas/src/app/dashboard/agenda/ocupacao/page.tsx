import Link from 'next/link';
import { Icon } from '@/components/Icons';
import { addDaysKey, dayStartUtc, formatBookingWhen, todayKey, weekdayOf } from '@/lib/booking';
import { prisma } from '@/lib/db';
import { DAY_SHORT, parseSchedule } from '@/lib/hours';
import { formatHours, occupancyReport } from '@/lib/occupancy';
import { resourceColor } from '@/lib/palette';
import { requireActiveRestaurant } from '@/lib/session';

export const metadata = { title: 'Ocupação da agenda' };
export const dynamic = 'force-dynamic';

const RANGES = [7, 14, 30] as const;

/** Cor da barra: vazio chama atenção (âmbar), meio cheio é azul, quase lotado é verde, lotado é marinho. */
const barColor = (pct: number) => (pct >= 100 ? 'bg-[#0F1F3D]' : pct >= 75 ? 'bg-emerald-500' : pct >= 40 ? 'bg-electric-600' : 'bg-amber-400');

export default async function OcupacaoPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const restaurant = await requireActiveRestaurant();
  const sp = await searchParams;
  const dias = RANGES.find((r) => String(r) === sp.dias) ?? 14;
  const now = new Date();
  const from = todayKey(now);
  const rangeStart = dayStartUtc(from);
  const rangeEnd = new Date(dayStartUtc(addDaysKey(from, dias)).getTime());

  const [units, resources, bookings, offs, waiting] = await Promise.all([
    prisma.unit.findMany({ where: { restaurantId: restaurant.id, active: true }, select: { id: true, openingSchedule: true } }),
    prisma.resource.findMany({ where: { restaurantId: restaurant.id, active: true }, orderBy: { createdAt: 'asc' } }),
    prisma.booking.findMany({
      where: { restaurantId: restaurant.id, status: { in: ['PENDING', 'CONFIRMED', 'COMPLETED'] }, resourceId: { not: null }, startsAt: { lt: rangeEnd }, endsAt: { gt: rangeStart } },
      select: { unitId: true, resourceId: true, startsAt: true, endsAt: true },
    }),
    prisma.timeOff.findMany({ where: { restaurantId: restaurant.id, startsAt: { lt: rangeEnd }, endsAt: { gt: rangeStart } }, select: { unitId: true, resourceId: true, startsAt: true, endsAt: true } }),
    prisma.waitlistEntry.groupBy({ by: ['date'], where: { restaurantId: restaurant.id, status: 'WAITING', date: { gte: from, lt: addDaysKey(from, dias) } }, _count: { _all: true } }),
  ]);
  const waitByDay = new Map(waiting.map((w) => [w.date, w._count._all]));
  const report = occupancyReport({
    from,
    days: dias,
    units: units.map((u) => ({ id: u.id, schedule: parseSchedule(u.openingSchedule) })),
    resources: resources.map((r) => ({ id: r.id, unitId: r.unitId, capacity: r.capacity, schedule: parseSchedule(r.schedule) })),
    bookings,
    timeOffs: offs,
  });

  const open = report.days.filter((d) => d.pct !== null);
  const label = (date: string, i: number) => (i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : `${DAY_SHORT[weekdayOf(date)]} ${date.slice(8)}/${date.slice(5, 7)}`);
  const totalWaiting = [...waitByDay.values()].reduce((s, n) => s + n, 0);
  // Leituras prontas para o dono agir: onde sobra espaço, onde falta e onde há gente esperando.
  const emptiest = open.filter((d) => d.date >= from).sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0))[0];
  const fullest = [...open].sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))[0];
  const hot = report.days.filter((d) => (d.pct ?? 0) >= 85 && (waitByDay.get(d.date) ?? 0) > 0);
  const when = (date: string) => formatBookingWhen(new Date(`${date}T12:00:00-03:00`)).split(' às ')[0];

  const kpis: { label: string; value: string; hint: string }[] = [
    { label: 'Ocupação média', value: report.totals.pct === null ? '—' : `${report.totals.pct}%`, hint: `próximos ${dias} dias` },
    { label: 'Horas livres', value: formatHours(report.totals.freeMin), hint: 'ainda dá para vender' },
    { label: 'Agendamentos', value: String(report.totals.bookings), hint: 'marcados no período' },
    { label: 'Na lista de espera', value: String(totalWaiting), hint: 'esperando um horário' },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <Link href="/dashboard/agenda" className="inline-flex items-center gap-1 text-sm font-semibold text-electric-600"><Icon name="back" size={16} /> Agenda</Link>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-primary">Ocupação da agenda</h1>
        <p className="text-sm text-slate-600">Quanto do tempo da equipe já está vendido, dia a dia. Folgas e bloqueios não entram na conta.</p>
      </header>

      <nav aria-label="Período" className="chip-row">
        {RANGES.map((r) => (
          <Link key={r} href={`/dashboard/agenda/ocupacao?dias=${r}`} aria-current={r === dias ? 'true' : undefined} className={`chip-link shrink-0 ${r === dias ? 'chip-link-active' : ''}`}>{r} dias</Link>
        ))}
      </nav>

      <section aria-label="Resumo" className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="occupancy-kpis">
        {kpis.map((k) => (
          <div key={k.label} className="glass-panel-sm p-4">
            <p className="text-xs font-semibold text-slate-500">{k.label}</p>
            <p className="mt-1 text-2xl font-extrabold tracking-tight text-primary">{k.value}</p>
            <p className="text-xs text-slate-500">{k.hint}</p>
          </div>
        ))}
      </section>

      {open.length > 0 && (emptiest || hot.length > 0) && (
        <section aria-label="O que fazer" className="space-y-2 rounded-[22px] bg-primary p-4 text-white" data-testid="occupancy-insights">
          <p className="text-xs font-bold uppercase tracking-wider text-lime-300">O que o painel enxerga</p>
          <ul className="space-y-1.5 text-sm">
            {fullest && (fullest.pct ?? 0) >= 60 && <li>Dia mais cheio: <b>{when(fullest.date)}</b> ({fullest.pct}%).</li>}
            {emptiest && (emptiest.pct ?? 0) < 40 && <li>Sobra espaço em <b>{when(emptiest.date)}</b> ({emptiest.pct}% ocupado): bom dia para uma promoção ou um aviso aos clientes.</li>}
            {hot.map((d) => <li key={d.date}><b>{when(d.date)}</b> está quase lotado e tem {waitByDay.get(d.date)} {waitByDay.get(d.date) === 1 ? 'pessoa esperando' : 'pessoas esperando'}: vale abrir um encaixe.</li>)}
          </ul>
        </section>
      )}

      <section aria-labelledby="por-dia" className="glass-panel space-y-1 p-4 sm:p-5">
        <h2 id="por-dia" className="mb-2 text-lg font-bold text-primary">Dia a dia</h2>
        <ul className="divide-y divide-slate-100" data-testid="occupancy-days">
          {report.days.map((d, i) => {
            const wait = waitByDay.get(d.date) ?? 0;
            return (
              <li key={d.date} className="flex items-center gap-3 py-2.5" data-date={d.date}>
                <span className="w-20 shrink-0 text-sm font-semibold text-slate-700">{label(d.date, i)}</span>
                {d.pct === null ? (
                  <span className="flex-1 text-sm text-slate-400">Fechado ou bloqueado</span>
                ) : (
                  <>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${d.pct}% ocupado`}>
                      <div className={`h-full rounded-full ${barColor(d.pct)}`} style={{ width: `${Math.min(100, d.pct)}%` }} />
                    </div>
                    <span className="w-10 shrink-0 text-right text-sm font-bold text-slate-800">{d.pct}%</span>
                  </>
                )}
                <span className="hidden w-28 shrink-0 text-right text-xs text-slate-500 sm:block">{d.pct === null ? '' : `${d.bookings} agend. · ${formatHours(d.capacityMin - d.bookedMin)} livres`}</span>
                {wait > 0 && <span className="shrink-0 rounded-md bg-[#EAF0FF] px-2 py-0.5 text-xs font-semibold text-electric-600" title="Na lista de espera">{wait} na espera</span>}
              </li>
            );
          })}
        </ul>
      </section>

      {resources.length > 1 && (
        <section aria-labelledby="por-prof" className="glass-panel space-y-3 p-4 sm:p-5">
          <h2 id="por-prof" className="text-lg font-bold text-primary">Por profissional</h2>
          <ul className="space-y-3" data-testid="occupancy-staff">
            {resources.map((r) => {
              const v = report.byResource[r.id];
              const pct = v && v.capacityMin > 0 ? Math.round((v.bookedMin / v.capacityMin) * 100) : null;
              const tone = resourceColor(r);
              return (
                <li key={r.id} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-semibold text-slate-800">{r.name}</span>
                    <span className="text-xs text-slate-500">{pct === null ? 'sem horário no período' : `${pct}% · ${formatHours(v.bookedMin)} de ${formatHours(v.capacityMin)}`}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full" style={{ background: tone.soft }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct ?? 0)}%`, background: tone.hex }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
