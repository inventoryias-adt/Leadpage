import Link from 'next/link';
import { prisma } from '@/lib/db';
import { formatPoints, startOfMonthBR } from '@/lib/points';
import { requireActiveRestaurant } from '@/lib/session';

export const metadata = { title: 'Início' };
export const dynamic = 'force-dynamic';

export default async function DashboardHome() {
  const restaurant = await requireActiveRestaurant();
  const since = startOfMonthBR();

  const [customers, issued, redeemed, pending] = await Promise.all([
    prisma.wallet.count({ where: { restaurantId: restaurant.id } }),
    prisma.transaction.aggregate({
      _sum: { points: true },
      where: { type: 'EARN', createdAt: { gte: since }, wallet: { restaurantId: restaurant.id } },
    }),
    prisma.redemption.count({ where: { restaurantId: restaurant.id, createdAt: { gte: since } } }),
    prisma.redemption.count({ where: { restaurantId: restaurant.id, status: 'PENDING' } }),
  ]);

  const stats = [
    { label: 'Clientes na carteira', value: formatPoints(customers), href: '/dashboard/clientes' },
    { label: 'Pontos emitidos no mês', value: formatPoints(issued._sum.points ?? 0), href: '/dashboard/pontos' },
    { label: 'Resgates no mês', value: formatPoints(redeemed), href: '/dashboard/resgates#mes' },
    { label: 'Prêmios a entregar', value: formatPoints(pending), href: '/dashboard/resgates' },
  ];

  return (
    <div className="space-y-6">
      <Link href="/dashboard/caixa" className="glass-button py-5 text-lg">🧾 Lançar pontos no caixa</Link>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => {
          const card = (
            <div className="glass-panel-sm h-full p-4">
              <p className="text-3xl font-extrabold text-primary">{s.value}</p>
              <p className="text-sm text-slate-600">{s.label}</p>
              {s.href && <p className="mt-1 text-xs font-semibold text-electric-600">Ver detalhes →</p>}
            </div>
          );
          return s.href ? <Link key={s.label} href={s.href}>{card}</Link> : <div key={s.label}>{card}</div>;
        })}
      </div>
    </div>
  );
}
