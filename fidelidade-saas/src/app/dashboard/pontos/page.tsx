import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState';
import { MonthNav } from '@/components/MonthNav';
import { prisma } from '@/lib/db';
import { formatBRL, formatDateTimeBR, formatPoints, monthRangeBR } from '@/lib/points';
import { requireActiveRestaurant } from '@/lib/session';

export const metadata = { title: 'Pontos emitidos' };
export const dynamic = 'force-dynamic';

const LIMIT = 300;

export default async function PontosPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const restaurant = await requireActiveRestaurant();
  const range = monthRangeBR((await searchParams).mes);
  const where = { type: 'EARN' as const, createdAt: { gte: range.start, lt: range.end }, wallet: { restaurantId: restaurant.id } };

  const [sum, rows, perUnit, units, uses, purchases] = await Promise.all([
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
    prisma.promotionUse.findMany({
      where: { restaurantId: restaurant.id, createdAt: { gte: range.start, lt: range.end } },
      select: { promotionId: true, claimId: true, title: true, customerId: true, points: true, amountCents: true },
      take: 20000,
    }),
    prisma.claim.count({ where: { restaurantId: restaurant.id, redeemedAt: { gte: range.start, lt: range.end }, amountCents: { gt: 0 } } }),
  ]);

  // Relatório do mês por campanha: compras, clientes diferentes, pontos extras e vendas.
  const byPromo = new Map<string, { title: string; uses: number; customers: Set<string>; points: number; cents: number }>();
  for (const u of uses) {
    const key = u.promotionId ?? `removida:${u.title}`;
    const row = byPromo.get(key) ?? { title: u.title, uses: 0, customers: new Set<string>(), points: 0, cents: 0 };
    row.uses += 1;
    row.customers.add(u.customerId);
    row.points += u.points;
    row.cents += u.amountCents;
    byPromo.set(key, row);
  }
  const promoRows = [...byPromo.values()].sort((a, b) => b.points - a.points);
  const claimsWithPromo = new Set(uses.map((u) => u.claimId)).size;
  const extraTotal = uses.reduce((n, u) => n + u.points, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-5 lg:grid lg:grid-cols-5 lg:items-start lg:gap-6 lg:space-y-0">
      <section className="glass-panel space-y-4 p-5 sm:p-7 lg:col-span-2">
        <MonthNav range={range} basePath="/dashboard/pontos" />
        <a href="/dashboard/exportar/lancamentos" className="link-inline block text-sm" download>Baixar lançamentos do último ano (CSV)</a>
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
          <EmptyState compact variant="chart" title="Nenhum ponto emitido neste mês" text="Os pontos lançados no caixa e as compras lidas pelos clientes aparecem aqui." />
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

      <section className="glass-panel p-5 sm:p-7 lg:col-span-5" aria-labelledby="rel-campanhas">
        <h2 id="rel-campanhas" className="mb-1 font-bold text-primary">Campanhas no mês</h2>
        <p className="mb-4 text-sm text-slate-500">Quanto cada campanha rendeu em pontos extras e em vendas, no mês escolhido acima.</p>
        {promoRows.length === 0 ? (
          <EmptyState
            compact
            variant="coin"
            title="Nenhuma campanha rendeu pontos neste mês"
            text="Quando uma compra for creditada com uma campanha valendo, ela aparece aqui com os números."
            action={{ href: '/dashboard/configuracoes#campanhas', label: 'Criar uma campanha' }}
          />
        ) : (
          <>
            <div className="mb-4 grid grid-cols-3 gap-3">
              <div className="glass-inset p-3">
                <p className="text-2xl font-extrabold text-primary">{formatPoints(extraTotal)}</p>
                <p className="text-xs text-slate-600">pontos extras dados</p>
              </div>
              <div className="glass-inset p-3">
                <p className="text-2xl font-extrabold text-primary">{formatPoints(claimsWithPromo)}</p>
                <p className="text-xs text-slate-600">compras com campanha</p>
              </div>
              <div className="glass-inset p-3">
                <p className="text-2xl font-extrabold text-primary">{purchases > 0 ? Math.round((claimsWithPromo / purchases) * 100) : 0}%</p>
                <p className="text-xs text-slate-600">das compras do mês</p>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-[#e4e7f3]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#f6f8fd] text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Campanha</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Compras</th>
                    <th className="hidden px-3 py-2.5 text-right font-semibold sm:table-cell">Clientes</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Pontos extras</th>
                    <th className="hidden px-4 py-2.5 text-right font-semibold sm:table-cell">Vendas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e4e7f3]">
                  {promoRows.map((r) => (
                    <tr key={r.title}>
                      <td className="px-4 py-3 font-semibold text-slate-800">{r.title}</td>
                      <td className="px-3 py-3 text-right">{formatPoints(r.uses)}</td>
                      <td className="hidden px-3 py-3 text-right sm:table-cell">{formatPoints(r.customers.size)}</td>
                      <td className="px-3 py-3 text-right font-bold text-electric-600">+{formatPoints(r.points)}</td>
                      <td className="hidden px-4 py-3 text-right sm:table-cell">{formatBRL(r.cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-slate-500">Uma compra pode contar em mais de uma campanha. “Vendas” é o valor das compras que usaram a campanha.</p>
          </>
        )}
      </section>
    </div>
  );
}
