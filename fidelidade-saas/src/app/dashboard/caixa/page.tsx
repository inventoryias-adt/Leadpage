import { CaixaForm } from '@/components/CaixaForm';
import { prisma } from '@/lib/db';
import { formatPoints } from '@/lib/points';
import { requireActiveRestaurant } from '@/lib/session';

export const metadata = { title: 'Caixa' };
export const dynamic = 'force-dynamic';

export default async function CaixaPage() {
  const restaurant = await requireActiveRestaurant();
  const [rules, recent] = await Promise.all([
    prisma.interactionRule.findMany({
      where: { restaurantId: restaurant.id, active: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, label: true, points: true },
    }),
    prisma.claim.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { customer: { select: { name: true } } },
    }),
  ]);

  const now = Date.now();
  const statusOf = (c: (typeof recent)[number]) =>
    c.redeemedAt ? `Creditado a ${c.customer?.name ?? 'cliente'}` : c.expiresAt.getTime() < now ? 'Expirado' : 'Aguardando leitura';

  return (
    <div className="mx-auto grid max-w-4xl grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <CaixaForm pointsPerReal={restaurant.pointsPerReal} rules={rules} />

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
                    {c.createdAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })} · {statusOf(c)}
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
