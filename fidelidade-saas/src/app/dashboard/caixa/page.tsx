import { CaixaForm } from '@/components/CaixaForm';
import { prisma } from '@/lib/db';
import { formatPoints } from '@/lib/points';
import { requireActiveRestaurant } from '@/lib/session';
import { Icon } from '@/components/Icons';
import { currentUnit } from '@/lib/units';

export const metadata = { title: 'Caixa' };
export const dynamic = 'force-dynamic';

export default async function CaixaPage() {
  const restaurant = await requireActiveRestaurant();
  const [rules, recent, { unit, units }] = await Promise.all([
    prisma.interactionRule.findMany({
      where: { restaurantId: restaurant.id, active: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, label: true, points: true },
    }),
    prisma.claim.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { customer: { select: { name: true } }, unit: { select: { name: true } } },
    }),
    currentUnit(restaurant.id),
  ]);

  const now = Date.now();
  const statusOf = (c: (typeof recent)[number]) =>
    c.redeemedAt ? `Creditado a ${c.customer?.name ?? 'cliente'}` : c.expiresAt.getTime() < now ? 'Expirado' : 'Aguardando leitura';

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <div>
        {units.length > 1 && unit && (
          <p className="glass-inset mb-4 flex items-center gap-2 px-4 py-3 text-sm text-slate-700">
            <Icon name="pin" size={16} className="text-electric-600" />
            Lançando pela unidade <strong className="text-primary">{unit.name}</strong>
            <span className="text-slate-500">(troque no topo da tela)</span>
          </p>
        )}
        <CaixaForm pointsPerReal={restaurant.pointsPerReal} rules={rules} />
      </div>

      <section className="glass-panel h-fit p-5">
        <h2 className="mb-3 font-bold text-primary">Últimos lançamentos</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-slate-500">Nada por aqui ainda.</p>
        ) : (
          <ul className="divide-y divide-white/60">
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
      </section>
    </div>
  );
}
