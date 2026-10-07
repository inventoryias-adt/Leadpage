import { markRedemptionUsed } from '@/app/actions/restaurant';
import { SubmitButton } from '@/components/ui';
import { maskCpf } from '@/lib/br';
import { prisma } from '@/lib/db';
import { formatPoints, monthRangeBR } from '@/lib/points';
import { MonthNav } from '@/components/MonthNav';
import Link from 'next/link';
import { requireActiveRestaurant } from '@/lib/session';

export const metadata = { title: 'Resgates' };
export const dynamic = 'force-dynamic';

const when = (d: Date) =>
  d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });

export default async function ResgatesPage({ searchParams }: { searchParams: Promise<{ q?: string; mes?: string }> }) {
  const restaurant = await requireActiveRestaurant();
  const sp = await searchParams;
  const q = sp.q?.trim().toUpperCase() ?? '';
  const range = monthRangeBR(sp.mes);

  const include = { customer: { select: { id: true, name: true, cpf: true } } } as const;
  const [pending, used, month] = await Promise.all([
    prisma.redemption.findMany({
      where: { restaurantId: restaurant.id, status: 'PENDING', ...(q ? { code: { contains: q } } : {}) },
      orderBy: { createdAt: 'asc' },
      include,
    }),
    prisma.redemption.findMany({
      where: { restaurantId: restaurant.id, status: 'USED' },
      orderBy: { usedAt: 'desc' },
      take: 10,
      include,
    }),
    prisma.redemption.findMany({
      where: { restaurantId: restaurant.id, createdAt: { gte: range.start, lt: range.end } },
      orderBy: { createdAt: 'desc' },
      take: 300,
      include,
    }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section className="glass-panel p-5 sm:p-7">
        <h1 className="mb-1 text-xl font-bold text-primary">Prêmios a entregar</h1>
        <p className="mb-4 text-sm text-slate-500">Confira o código mostrado pelo cliente e marque como entregue.</p>

        <form className="mb-4 flex gap-2" role="search">
          <input name="q" defaultValue={q} className="glass-input uppercase tracking-widest" placeholder="Código (ex.: K7M2QX)" aria-label="Buscar por código" maxLength={6} />
          <button className="glass-button-ghost !w-auto">Buscar</button>
        </form>

        {pending.length === 0 ? (
          <p className="text-sm text-slate-500">{q ? 'Nenhum resgate pendente com esse código.' : 'Nenhum prêmio aguardando entrega.'}</p>
        ) : (
          <ul className="space-y-3">
            {pending.map((r) => (
              <li key={r.id} className="glass-inset flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-mono text-xl font-bold tracking-[0.25em] text-electric-600">{r.code}</p>
                  <p className="truncate font-semibold text-slate-800">{r.rewardName}</p>
                  <p className="text-xs text-slate-500">
                    <Link href={`/dashboard/clientes/${r.customer.id}`} className="font-semibold text-electric-600 hover:underline">{r.customer.name}</Link> · CPF {maskCpf(r.customer.cpf)} · {when(r.createdAt)}
                  </p>
                </div>
                <form action={markRedemptionUsed}>
                  <input type="hidden" name="id" value={r.id} />
                  <SubmitButton pendingText="…" className="!w-auto !px-4 !py-2 text-sm">Entregar</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {used.length > 0 && (
        <section className="glass-panel p-5 sm:p-7">
          <h2 className="mb-3 font-bold text-primary">Entregues recentemente</h2>
          <ul className="divide-y divide-white/60 text-sm">
            {used.map((r) => (
              <li key={r.id} className="flex justify-between gap-3 py-2">
                <span className="truncate text-slate-800">{r.rewardName} · {r.customer.name}</span>
                <span className="shrink-0 text-slate-500">{formatPoints(r.pointsCost)} pts · {r.usedAt ? when(r.usedAt) : ''}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section id="mes" className="glass-panel space-y-4 p-5 sm:p-7">
        <h2 className="font-bold text-primary">Resgates do mês</h2>
        <MonthNav range={range} basePath="/dashboard/resgates" />
        <p className="text-sm text-slate-600">
          {month.length} {month.length === 1 ? 'resgate' : 'resgates'} · {formatPoints(month.reduce((a, r) => a + r.pointsCost, 0))} pts usados
        </p>
        {month.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum resgate neste mês.</p>
        ) : (
          <ul className="divide-y divide-white/60 text-sm">
            {month.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800">{r.rewardName}</p>
                  <Link href={`/dashboard/clientes/${r.customer.id}`} className="text-electric-600 hover:underline">{r.customer.name}</Link>
                  <p className="text-xs text-slate-500">
                    {when(r.createdAt)} · {r.status === 'USED' ? 'entregue' : 'a entregar'}
                  </p>
                </div>
                <span className="shrink-0 font-bold text-slate-600">−{formatPoints(r.pointsCost)} pts</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
