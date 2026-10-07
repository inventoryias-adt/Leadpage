import Link from 'next/link';
import { MonthNav } from '@/components/MonthNav';
import { prisma } from '@/lib/db';
import { formatDateTimeBR, formatPoints, monthRangeBR } from '@/lib/points';
import { requireActiveRestaurant } from '@/lib/session';

export const metadata = { title: 'Pontos emitidos' };
export const dynamic = 'force-dynamic';

const LIMIT = 300;

export default async function PontosPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const restaurant = await requireActiveRestaurant();
  const range = monthRangeBR((await searchParams).mes);
  const where = { type: 'EARN' as const, createdAt: { gte: range.start, lt: range.end }, wallet: { restaurantId: restaurant.id } };

  const [sum, rows, perUnit, units] = await Promise.all([
    prisma.transaction.aggregate({ _sum: { points: true }, _count: true, where }),
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: LIMIT,
      include: {
        wallet: { select: { customer: { select: { id: true, name: true } } } },
        claim: { select: { unit: { select: { name: true } } } },
      },
    }),
    prisma.claim.groupBy({
      by: ['unitId'],
      where: { restaurantId: restaurant.id, redeemedAt: { gte: range.start, lt: range.end } },
      _sum: { points: true },
      _count: true,
    }),
    prisma.unit.findMany({ where: { restaurantId: restaurant.id }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-5 lg:grid lg:grid-cols-5 lg:items-start lg:gap-6 lg:space-y-0">
      <section className="glass-panel space-y-4 p-5 sm:p-7 lg:col-span-2">
        <MonthNav range={range} basePath="/dashboard/pontos" />
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-inset p-3">
            <p className="text-2xl font-extrabold text-primary">{formatPoints(sum._sum.points ?? 0)}</p>
            <p className="text-xs text-slate-600">pontos emitidos</p>
          </div>
          <div className="glass-inset p-3">
            <p className="text-2xl font-extrabold text-primary">{formatPoints(sum._count)}</p>
            <p className="text-xs text-slate-600">pontuações</p>
          </div>
        </div>
        {units.length > 1 && perUnit.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">Compras por unidade</p>
            <ul className="divide-y divide-slate-200/70 rounded-2xl border border-slate-200/80 bg-white/60 text-sm">
              {perUnit.map((u) => (
                <li key={u.unitId ?? 'sem'} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="font-medium text-slate-800">{units.find((x) => x.id === u.unitId)?.name ?? 'Sem unidade'}</span>
                  <span className="text-slate-600">{u._count} {u._count === 1 ? 'lançamento' : 'lançamentos'} · <strong className="text-primary">{formatPoints(u._sum.points ?? 0)} pts</strong></span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="glass-panel p-5 sm:p-7 lg:col-span-3">
        <h1 className="mb-3 font-bold text-primary">Quem recebeu pontos</h1>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum ponto emitido neste mês.</p>
        ) : (
          <ul className="divide-y divide-white/60">
            {rows.map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <Link href={`/dashboard/clientes/${t.wallet.customer.id}`} className="link-inline">
                    {t.wallet.customer.name}
                  </Link>
                  <p className="text-slate-700">{t.description}</p>
                  <p className="text-xs text-slate-500">{formatDateTimeBR(t.createdAt)}{units.length > 1 && t.claim?.unit ? ` · ${t.claim.unit.name}` : ''}</p>
                </div>
                <span className="shrink-0 font-bold text-emerald-600">+{formatPoints(t.points)}</span>
              </li>
            ))}
          </ul>
        )}
        {sum._count > LIMIT && <p className="mt-3 text-center text-xs text-slate-500">Mostrando os {LIMIT} lançamentos mais recentes do mês.</p>}
      </section>
    </div>
  );
}
