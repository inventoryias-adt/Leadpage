import Link from 'next/link';
import { removeTimeOff } from '@/app/actions/agenda';
import { Icon } from '@/components/Icons';
import { TimeOffForm } from '@/components/TimeOffForm';
import { formatBookingWhen, formatTimeOff, todayKey } from '@/lib/booking';
import { prisma } from '@/lib/db';
import { requireActiveRestaurant } from '@/lib/session';

export const metadata = { title: 'Folgas e bloqueios' };
export const dynamic = 'force-dynamic';

export default async function FolgasPage() {
  const restaurant = await requireActiveRestaurant();
  const now = new Date();
  const [staff, offs] = await Promise.all([
    prisma.resource.findMany({ where: { restaurantId: restaurant.id, active: true }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true } }),
    prisma.timeOff.findMany({ where: { restaurantId: restaurant.id, endsAt: { gt: now } }, orderBy: { startsAt: 'asc' }, include: { resource: { select: { name: true } } }, take: 100 }),
  ]);
  const names = new Map(staff.map((p) => [p.id, p.name]));
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <Link href="/dashboard/agenda" className="inline-flex items-center gap-1 text-sm font-semibold text-electric-600"><Icon name="back" size={16} /> Agenda</Link>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-primary">Folgas e bloqueios</h1>
        <p className="text-sm text-slate-600">Férias, folga, almoço, feriado ou manutenção: o período some da agenda do cliente, então ninguém marca em cima. Quem já tinha horário marcado continua valendo.</p>
      </header>
      <section className="glass-panel space-y-3 p-4 sm:p-5" aria-labelledby="novo-bloqueio">
        <h2 id="novo-bloqueio" className="text-lg font-bold text-primary">Novo bloqueio</h2>
        <TimeOffForm staff={staff} today={todayKey(now)} />
      </section>
      <section aria-labelledby="bloqueios">
        <h2 id="bloqueios" className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Próximos bloqueios</h2>
        {offs.length === 0 ? (
          <p className="glass-panel-sm p-4 text-sm text-slate-600">Nenhum bloqueio por enquanto.</p>
        ) : (
          <ul className="space-y-2" data-testid="timeoff-list">
            {offs.map((o) => (
              <li key={o.id} className="glass-panel-sm flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-bold text-slate-800">{o.resourceId ? names.get(o.resourceId) ?? o.resource?.name : 'Todos'}{o.reason ? ` · ${o.reason}` : ''}</p>
                  <p className="text-sm text-slate-600">{formatTimeOff(o.startsAt, o.endsAt)}</p>
                </div>
                <form action={removeTimeOff}>
                  <input type="hidden" name="id" value={o.id} />
                  <button className="btn-danger btn-sm" aria-label={`Remover bloqueio de ${formatBookingWhen(o.startsAt)}`}>Remover</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
