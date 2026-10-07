import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { maskCpf, formatPhone, onlyDigits } from '@/lib/br';
import { prisma } from '@/lib/db';
import { formatDateTimeBR, formatPoints } from '@/lib/points';
import { requireActiveRestaurant } from '@/lib/session';

export const metadata = { title: 'Clientes' };
export const dynamic = 'force-dynamic';

const LIMIT = 100;

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const restaurant = await requireActiveRestaurant();
  const q = (await searchParams).q?.trim() ?? '';
  const digits = onlyDigits(q);

  const customerFilter: Prisma.CustomerWhereInput | undefined = q
    ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, ...(digits ? [{ cpf: { contains: digits } }, { phone: { contains: digits } }] : [])] }
    : undefined;

  const [total, wallets] = await Promise.all([
    prisma.wallet.count({ where: { restaurantId: restaurant.id } }),
    prisma.wallet.findMany({
      where: { restaurantId: restaurant.id, ...(customerFilter ? { customer: customerFilter } : {}) },
      include: { customer: { select: { id: true, name: true, cpf: true, phone: true } } },
      orderBy: { balance: 'desc' },
      take: LIMIT,
    }),
  ]);

  // Totais por carteira (ganhos, resgates, última atividade) numa única consulta agregada.
  const stats = await prisma.transaction.groupBy({
    by: ['walletId', 'type'],
    where: { walletId: { in: wallets.map((w) => w.id) } },
    _sum: { points: true },
    _count: true,
    _max: { createdAt: true },
  });
  const byWallet = new Map<string, { earned: number; redeemed: number; visits: number; last?: Date }>();
  for (const s of stats) {
    const cur = byWallet.get(s.walletId) ?? { earned: 0, redeemed: 0, visits: 0 };
    if (s.type === 'EARN') {
      cur.earned += s._sum.points ?? 0;
      cur.visits += s._count;
    } else cur.redeemed += s._sum.points ?? 0;
    const last = s._max.createdAt ?? undefined;
    if (last && (!cur.last || last > cur.last)) cur.last = last;
    byWallet.set(s.walletId, cur);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <section className="glass-panel p-5 sm:p-7">
        <h1 className="mb-1 text-xl font-bold text-primary">Clientes</h1>
        <p className="mb-4 text-sm text-slate-500">
          {formatPoints(total)} {total === 1 ? 'cliente tem' : 'clientes têm'} carteira no seu restaurante. Toque em um cliente para ver todo o histórico.
        </p>
        <form className="flex gap-2" role="search">
          <input name="q" defaultValue={q} className="glass-input" placeholder="Buscar por nome, CPF ou telefone" aria-label="Buscar cliente" />
          <button className="glass-button-ghost !w-auto">Buscar</button>
        </form>
      </section>

      {wallets.length === 0 ? (
        <p className="glass-panel p-6 text-center text-sm text-slate-600">
          {q ? 'Nenhum cliente encontrado.' : 'Ainda não há clientes. Eles aparecem aqui quando leem o primeiro QR Code.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {wallets.map((w) => {
            const s = byWallet.get(w.id) ?? { earned: 0, redeemed: 0, visits: 0 };
            return (
              <li key={w.id}>
                <Link href={`/dashboard/clientes/${w.customer.id}`} className="glass-panel-sm block p-4 transition hover:bg-white/60">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-800">{w.customer.name}</p>
                      <p className="text-xs text-slate-500">
                        CPF {maskCpf(w.customer.cpf)} · {formatPhone(w.customer.phone)}
                      </p>
                    </div>
                    <p className="shrink-0 text-right">
                      <span className="text-2xl font-extrabold text-primary">{formatPoints(w.balance)}</span>
                      <span className="ml-1 text-xs font-semibold text-electric-600">pts</span>
                    </p>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">
                    {s.visits} {s.visits === 1 ? 'pontuação' : 'pontuações'} · {formatPoints(s.earned)} pts recebidos · {formatPoints(s.redeemed)} pts usados
                    {s.last && <> · última atividade {formatDateTimeBR(s.last)}</>}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {total > LIMIT && !q && <p className="text-center text-xs text-slate-500">Mostrando os {LIMIT} clientes com mais pontos. Use a busca para encontrar os demais.</p>}
    </div>
  );
}
