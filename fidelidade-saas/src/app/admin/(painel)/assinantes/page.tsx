import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { STATUS_LOOK, StatusChip } from '@/components/StatusChip';
import { EmptyState } from '@/components/EmptyState';
import { onlyDigits } from '@/lib/br';
import { prisma } from '@/lib/db';
import { formatDateTimeBR, formatPoints } from '@/lib/points';

export const metadata = { title: 'Assinantes' };

const LIMIT = 100;
const DAY = 24 * 60 * 60 * 1000;
const STATUSES = ['ACTIVE', 'PENDING', 'PAST_DUE', 'CANCELED'] as const;

export default async function Assinantes({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? '';
  const status = STATUSES.find((s) => s === sp.status);
  const digits = onlyDigits(q);

  const where: Prisma.RestaurantWhereInput = {
    ...(status ? { subscriptionStatus: status } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }, ...(digits ? [{ phone: { contains: digits } }] : [])] } : {}),
  };

  const [counts, rows] = await Promise.all([
    prisma.restaurant.groupBy({ by: ['subscriptionStatus'], _count: true }),
    prisma.restaurant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: LIMIT,
      select: { id: true, name: true, email: true, phone: true, subscriptionStatus: true, createdAt: true, onboardedAt: true, _count: { select: { wallets: true, units: true } } },
    }),
  ]);
  const ids = rows.map((r) => r.id);
  const [recent, last] = await Promise.all([
    prisma.claim.groupBy({ by: ['restaurantId'], where: { restaurantId: { in: ids }, redeemedAt: { gte: new Date(Date.now() - 30 * DAY) } }, _sum: { points: true }, _count: true }),
    prisma.claim.groupBy({ by: ['restaurantId'], where: { restaurantId: { in: ids }, redeemedAt: { not: null } }, _max: { redeemedAt: true } }),
  ]);
  const recentBy = new Map(recent.map((c) => [c.restaurantId, c]));
  const lastBy = new Map(last.map((c) => [c.restaurantId, c._max.redeemedAt]));
  const total = counts.reduce((n, c) => n + c._count, 0);
  const countOf = (s: string) => counts.find((c) => c.subscriptionStatus === s)?._count ?? 0;

  const tab = (href: string, on: boolean, label: string, n: number) => (
    <Link href={href} aria-current={on ? 'true' : undefined} className={`${on ? 'glass-button' : 'glass-button-ghost'} shrink-0 !w-auto !px-4 !py-1.5 !text-sm`}>
      {label} <span className="opacity-70">{n}</span>
    </Link>
  );

  return (
    <div className="space-y-5">
      <section className="glass-panel p-5 sm:p-7">
        <h1 className="mb-1 text-xl font-semibold text-primary">Assinantes</h1>
        <p className="mb-4 text-sm text-slate-500">{formatPoints(total)} {total === 1 ? 'conta' : 'contas'} na plataforma.</p>
        <nav aria-label="Status" className="chip-row mb-4">
          {tab('/admin/assinantes', !status, 'Todos', total)}
          {STATUSES.map((s) => tab(`/admin/assinantes?status=${s}`, status === s, STATUS_LOOK[s].label, countOf(s)))}
        </nav>
        <form className="flex gap-2" role="search">
          {status && <input type="hidden" name="status" value={status} />}
          <input name="q" defaultValue={q} className="glass-input" placeholder="Buscar por nome, e-mail ou telefone" aria-label="Buscar assinante" />
          <button className="glass-button-ghost !w-auto">Buscar</button>
        </form>
      </section>

      {rows.length === 0 ? (
        <EmptyState variant="users" title="Nenhum assinante encontrado" text="Ajuste a busca ou o filtro de status." />
      ) : (
        <div className="glass-panel overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f6f8fd] text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Assinante</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="hidden px-3 py-3 text-right font-semibold md:table-cell">Clientes</th>
                <th className="hidden px-3 py-3 text-right font-semibold lg:table-cell">Pontos (30 dias)</th>
                <th className="hidden px-4 py-3 font-semibold md:table-cell">Última compra</th>
                <th className="hidden px-4 py-3 font-semibold lg:table-cell">Cadastro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e4e7f3]">
              {rows.map((r) => {
                const rec = recentBy.get(r.id);
                const lb = lastBy.get(r.id);
                return (
                  <tr key={r.id} className="transition-colors hover:bg-[#f6f8fd]">
                    <td className="px-4 py-3">
                      <Link href={`/admin/assinantes/${r.id}`} className="block">
                        <span className="block font-semibold text-slate-800">{r.name}</span>
                        <span className="block text-xs text-slate-500">{r.email}</span>
                        {!r.onboardedAt && r.subscriptionStatus === 'ACTIVE' && <span className="text-xs font-semibold text-amber-700">configuração pendente</span>}
                      </Link>
                    </td>
                    <td className="px-3 py-3"><StatusChip status={r.subscriptionStatus} /></td>
                    <td className="hidden px-3 py-3 text-right md:table-cell">{formatPoints(r._count.wallets)}</td>
                    <td className="hidden px-3 py-3 text-right lg:table-cell">{formatPoints(rec?._sum.points ?? 0)}</td>
                    <td className="hidden px-4 py-3 text-slate-600 md:table-cell">{lb ? formatDateTimeBR(lb) : '—'}</td>
                    <td className="hidden px-4 py-3 text-slate-600 lg:table-cell">{formatDateTimeBR(r.createdAt).split(' às ')[0]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows.length === LIMIT && <p className="text-center text-xs text-slate-500">Mostrando os {LIMIT} mais recentes. Use a busca para achar os demais.</p>}
    </div>
  );
}
