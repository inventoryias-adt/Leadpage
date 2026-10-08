import Link from 'next/link';
import { adminImpersonate } from '@/app/actions/admin';
import { AreaChart, type AreaPoint } from '@/components/AreaChart';
import { StatusChip } from '@/components/StatusChip';
import { KpiCard } from '@/components/DashboardCharts';
import { EmptyState } from '@/components/EmptyState';
import { prisma } from '@/lib/db';
import { WEEKDAYS, brtParts } from '@/lib/insights';
import { PLAN_PRICE_CENTS } from '@/lib/payments';
import { formatBRL, formatPoints } from '@/lib/points';

export const metadata = { title: 'Visão geral' };

const DAY = 24 * 60 * 60 * 1000;

export default async function AdminHome() {
  const now = Date.now();
  const d30 = new Date(now - 30 * DAY);
  const d14 = new Date(now - 14 * DAY);

  const [byStatus, signups, customers, points, purchases, lastClaims, restaurants, testAccounts] = await Promise.all([
    prisma.restaurant.groupBy({ by: ['subscriptionStatus'], where: { isTest: false }, _count: true }),
    prisma.restaurant.findMany({ where: { createdAt: { gte: d30 }, isTest: false }, select: { createdAt: true } }),
    prisma.customer.count(),
    prisma.transaction.aggregate({ where: { type: 'EARN', createdAt: { gte: d30 } }, _sum: { points: true } }),
    prisma.claim.count({ where: { redeemedAt: { gte: d30 }, amountCents: { gt: 0 } } }),
    prisma.claim.groupBy({ by: ['restaurantId'], where: { redeemedAt: { not: null } }, _max: { redeemedAt: true } }),
    prisma.restaurant.findMany({
      where: { isTest: false },
      select: { id: true, name: true, email: true, subscriptionStatus: true, createdAt: true, onboardedAt: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    prisma.restaurant.findMany({ where: { isTest: true }, select: { id: true, name: true, email: true, subscriptionStatus: true }, orderBy: { createdAt: 'asc' } }),
  ]);

  const count = (s: string) => byStatus.find((x) => x.subscriptionStatus === s)?._count ?? 0;
  const active = count('ACTIVE');
  const last = new Map(lastClaims.map((c) => [c.restaurantId, c._max.redeemedAt]));

  // Contas que precisam de uma olhada
  const attention = restaurants
    .map((r) => {
      const age = now - r.createdAt.getTime();
      const lastBuy = last.get(r.id) ?? null;
      if (r.subscriptionStatus === 'PAST_DUE') return { r, why: 'Cobrança falhou' };
      if (r.subscriptionStatus === 'PENDING' && age > 2 * DAY) return { r, why: 'Cadastrou e não pagou há mais de 2 dias' };
      if (r.subscriptionStatus === 'ACTIVE' && !r.onboardedAt && age > 3 * DAY) return { r, why: 'Pagou e não terminou a configuração' };
      if (r.subscriptionStatus === 'ACTIVE' && r.onboardedAt && (!lastBuy || lastBuy < d14)) return { r, why: lastBuy ? 'Sem compras lançadas há mais de 14 dias' : 'Configurou mas nunca lançou uma compra' };
      return null;
    })
    .filter((x): x is { r: (typeof restaurants)[number]; why: string } => !!x)
    .slice(0, 10);

  // Cadastros por dia (30 dias)
  const perDay: number[] = Array(30).fill(0);
  for (const s of signups) {
    const i = 29 - Math.floor((now - s.createdAt.getTime()) / DAY);
    if (i >= 0 && i < 30) perDay[i] += 1;
  }
  const signupPoints: AreaPoint[] = perDay.map((n, i) => {
    const ymd = brtParts(new Date(now - (29 - i) * DAY)).ymd;
    const label = `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
    return {
      label,
      value: n,
      active: n > 0,
      title: `${WEEKDAYS[new Date(`${ymd}T12:00:00Z`).getUTCDay()]}, ${label}`,
      strong: `${n} ${n === 1 ? 'cadastro' : 'cadastros'}`,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-primary">Visão geral</h1>
        <p className="text-sm text-slate-600">A plataforma inteira, em um só lugar.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link href="/admin/assinantes?status=ACTIVE" className="card-link rounded-2xl"><KpiCard label="Assinantes ativos" value={formatPoints(active)} hint="pagando a assinatura" /></Link>
        <KpiCard label="Receita mensal" value={formatBRL(active * PLAN_PRICE_CENTS)} hint={`${active} × ${formatBRL(PLAN_PRICE_CENTS)}`} />
        <Link href="/admin/assinantes?status=PENDING" className="card-link rounded-2xl"><KpiCard label="Aguardando pagamento" value={formatPoints(count('PENDING'))} hint="cadastraram e não pagaram" /></Link>
        <Link href="/admin/assinantes?status=PAST_DUE" className="card-link rounded-2xl"><KpiCard label="Inadimplentes" value={formatPoints(count('PAST_DUE'))} hint={`${count('CANCELED')} canceladas`} /></Link>
        <KpiCard label="Novos em 30 dias" value={formatPoints(signups.length)} hint="cadastros" />
        <KpiCard label="Clientes finais" value={formatPoints(customers)} hint="carteiras criadas na plataforma" />
        <KpiCard label="Compras em 30 dias" value={formatPoints(purchases)} hint="lançadas e lidas pelos clientes" />
        <KpiCard label="Pontos emitidos (30 dias)" value={formatPoints(points._sum.points ?? 0)} hint="em todos os estabelecimentos" />
      </div>

      {testAccounts.length > 0 && (
        <section className="glass-panel p-5 sm:p-6" aria-labelledby="testes">
          <h2 id="testes" className="mb-1 font-semibold text-primary">Contas de teste</h2>
          <p className="mb-3 text-sm text-slate-500">Use para experimentar novidades antes de liberar aos clientes. Não entram na receita nem nos números acima.</p>
          <ul className="divide-y divide-[#E5E7EB]">
            {testAccounts.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <Link href={`/admin/assinantes/${t.id}`} className="min-w-0">
                  <span className="block truncate font-semibold text-slate-800">{t.name}</span>
                  <span className="text-xs text-slate-500">{t.email}</span>
                </Link>
                <span className="flex items-center gap-3">
                  <StatusChip status={t.subscriptionStatus} />
                  <form action={adminImpersonate}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className="glass-button btn-sm">Entrar</button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="glass-panel p-5 sm:p-6" aria-labelledby="cad-dia">
        <h2 id="cad-dia" className="mb-1 font-semibold text-primary">Cadastros por dia</h2>
        <p className="mb-4 text-sm text-slate-500">Últimos 30 dias.</p>
        <AreaChart points={signupPoints} label="Cadastros por dia nos últimos 30 dias" empty="Nenhum cadastro nos últimos 30 dias" />
      </section>

      <section className="glass-panel p-5 sm:p-6" aria-labelledby="atencao">
        <h2 id="atencao" className="mb-1 font-semibold text-primary">Precisam de atenção</h2>
        <p className="mb-4 text-sm text-slate-500">Contas que podem estar travadas ou prestes a cancelar.</p>
        {attention.length === 0 ? (
          <EmptyState compact variant="shield" title="Tudo em ordem" text="Nenhuma conta precisando de atenção agora." />
        ) : (
          <ul className="divide-y divide-[#E5E7EB]">
            {attention.map(({ r, why }) => (
              <li key={r.id}>
                <Link href={`/admin/assinantes/${r.id}`} className="flex items-center justify-between gap-3 rounded-xl py-3 transition-colors hover:bg-[#F6F7F9]">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-slate-800">{r.name}</span>
                    <span className="text-xs text-slate-500">{why}</span>
                  </span>
                  <StatusChip status={r.subscriptionStatus} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
