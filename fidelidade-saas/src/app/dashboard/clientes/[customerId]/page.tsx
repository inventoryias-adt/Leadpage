import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatPhone, maskCpf } from '@/lib/br';
import { prisma } from '@/lib/db';
import { formatDateTimeBR, formatPoints } from '@/lib/points';
import { requireActiveRestaurant } from '@/lib/session';

export const metadata = { title: 'Cliente' };
export const dynamic = 'force-dynamic';

export default async function ClienteDetalhe({ params }: { params: Promise<{ customerId: string }> }) {
  const restaurant = await requireActiveRestaurant();
  const { customerId } = await params;

  // Uma única rodada em paralelo. Só mostra clientes que têm carteira neste restaurante.
  const ofWallet = { customerId, restaurantId: restaurant.id };
  const [wallet, transactions, redemptions, totals] = await Promise.all([
    prisma.wallet.findUnique({
      where: { customerId_restaurantId: ofWallet },
      include: { customer: true },
    }),
    prisma.transaction.findMany({ where: { wallet: ofWallet }, orderBy: { createdAt: 'desc' }, take: 200 }),
    prisma.redemption.findMany({ where: ofWallet, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.transaction.groupBy({ by: ['type'], where: { wallet: ofWallet }, _sum: { points: true }, _count: true }),
  ]);
  if (!wallet) notFound();
  const earn = totals.find((t) => t.type === 'EARN');
  const redeem = totals.find((t) => t.type === 'REDEEM');
  const { customer } = wallet;
  const phoneDigits = customer.phone;

  const summary = [
    { label: 'Saldo atual', value: `${formatPoints(wallet.balance)} pts` },
    { label: 'Pontos recebidos', value: `${formatPoints(earn?._sum.points ?? 0)} pts` },
    { label: 'Pontos usados', value: `${formatPoints(redeem?._sum.points ?? 0)} pts` },
    { label: 'Pontuações / resgates', value: `${earn?._count ?? 0} / ${redeem?._count ?? 0}` },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0">
      <Link href="/dashboard/clientes" className="text-sm font-semibold text-electric-600 lg:col-span-2">← Todos os clientes</Link>

      <section className="glass-panel p-5 sm:p-7 lg:col-span-2">
        <h1 className="text-2xl font-extrabold text-primary">{customer.name}</h1>
        <p className="text-sm text-slate-600">
          CPF {maskCpf(customer.cpf)} · {formatPhone(customer.phone)} · cliente desde {formatDateTimeBR(wallet.createdAt).split(' às ')[0]}
        </p>
        <a
          href={`https://wa.me/55${phoneDigits}`}
          target="_blank"
          rel="noopener noreferrer"
          className="glass-button-ghost mt-3 !w-auto text-sm"
        >
          Chamar no WhatsApp
        </a>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {summary.map((s) => (
            <div key={s.label} className="glass-inset p-3">
              <p className="text-lg font-extrabold text-primary">{s.value}</p>
              <p className="text-xs text-slate-600">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-panel p-5 sm:p-7">
        <h2 className="mb-1 font-bold text-primary">Prêmios resgatados</h2>
        <p className="mb-3 text-sm text-slate-500">Produtos que este cliente trocou por pontos.</p>
        {redemptions.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum resgate ainda.</p>
        ) : (
          <ul className="divide-y divide-white/60">
            {redemptions.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800">{r.rewardName}</p>
                  <p className="text-xs text-slate-500">
                    Resgatado em {formatDateTimeBR(r.createdAt)} · código <span className="font-mono">{r.code}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {r.status === 'USED' ? `Entregue em ${r.usedAt ? formatDateTimeBR(r.usedAt) : '—'}` : 'Aguardando retirada no balcão'}
                  </p>
                </div>
                <span className="shrink-0 text-right">
                  <span className="block font-bold text-slate-600">−{formatPoints(r.pointsCost)} pts</span>
                  <span className={`mt-1 inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${r.status === 'USED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {r.status === 'USED' ? 'Entregue' : 'A entregar'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass-panel p-5 sm:p-7">
        <h2 className="mb-1 font-bold text-primary">Histórico de pontos</h2>
        <p className="mb-3 text-sm text-slate-500">Cada pontuação e resgate, com dia e horário.</p>
        {transactions.length === 0 ? (
          <p className="text-sm text-slate-500">Sem movimentações.</p>
        ) : (
          <ul className="divide-y divide-white/60">
            {transactions.map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="text-slate-800">{t.description}</p>
                  <p className="text-xs text-slate-500">{formatDateTimeBR(t.createdAt)}</p>
                </div>
                <span className={`shrink-0 font-bold ${t.type === 'EARN' ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {t.type === 'EARN' ? '+' : '−'}{formatPoints(t.points)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {transactions.length === 200 && <p className="mt-3 text-center text-xs text-slate-500">Mostrando as 200 movimentações mais recentes.</p>}
      </section>
    </div>
  );
}
