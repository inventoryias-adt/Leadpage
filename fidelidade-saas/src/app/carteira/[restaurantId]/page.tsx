import Link from 'next/link';
import { notFound } from 'next/navigation';
import { customerLogout } from '@/app/actions/customer';
import { prisma } from '@/lib/db';
import { formatPoints, startOfMonthBR } from '@/lib/points';
import { requireCustomer } from '@/lib/session';
import { RedeemButton } from './RedeemButton';

export const metadata = { title: 'Meus pontos' };
export const dynamic = 'force-dynamic';

const day = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'short' });

export default async function WalletPage({
  params,
  searchParams,
}: {
  params: Promise<{ restaurantId: string }>;
  searchParams: Promise<{ credited?: string }>;
}) {
  const { restaurantId } = await params;
  const credited = (await searchParams).credited === '1';
  const customer = await requireCustomer(`/carteira/${restaurantId}`);

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, name: true, address: true, maxRedeemsPerMonth: true },
  });
  if (!restaurant) notFound();

  const wallet = await prisma.wallet.findUnique({
    where: { customerId_restaurantId: { customerId: customer.id, restaurantId } },
  });
  if (!wallet) notFound(); // só quem já pontuou no restaurante vê a carteira

  const [rewards, history, vouchers, usedThisMonth] = await Promise.all([
    prisma.reward.findMany({ where: { restaurantId, active: true }, orderBy: { pointsCost: 'asc' } }),
    prisma.transaction.findMany({ where: { walletId: wallet.id }, orderBy: { createdAt: 'desc' }, take: 15 }),
    prisma.redemption.findMany({ where: { walletId: wallet.id, status: 'PENDING' }, orderBy: { createdAt: 'desc' } }),
    prisma.redemption.count({ where: { customerId: customer.id, restaurantId, createdAt: { gte: startOfMonthBR() } } }),
  ]);
  const limitReached = usedThisMonth >= restaurant.maxRedeemsPerMonth;

  return (
    <main className="safe-bottom mx-auto min-h-screen max-w-md p-4 sm:p-6">
      <header className="mb-6 flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-primary">Olá, {customer.name.split(' ')[0]} 👋</h1>
          <p className="truncate text-sm text-slate-500">{restaurant.name}</p>
        </div>
        <form action={customerLogout}><button className="text-sm font-semibold text-slate-500">Sair</button></form>
      </header>

      {credited && <p role="status" className="glass-success mb-4 animate-fade-in">Pontos creditados na sua carteira! 🎉</p>}

      {/* Saldo */}
      <section className="glass-panel relative mb-6 overflow-hidden p-6">
        <div aria-hidden className="absolute right-0 top-0 h-32 w-32 -translate-y-10 translate-x-10 rounded-full bg-white/70 blur-2xl" />
        <p className="mb-1 font-medium text-slate-600">Seu saldo atual</p>
        <p className="flex items-end gap-2">
          <span className="text-5xl font-extrabold text-primary">{formatPoints(wallet.balance)}</span>
          <span className="mb-1 text-lg font-semibold text-electric-600">pts</span>
        </p>
        <p className="mt-3 text-xs text-slate-500">Para ganhar mais, escaneie o QR Code que o caixa gerar na sua próxima conta.</p>
      </section>

      {/* Vouchers aguardando entrega */}
      {vouchers.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-lg font-bold text-slate-800">Prêmios para retirar</h2>
          <div className="space-y-3">
            {vouchers.map((v) => (
              <div key={v.id} className="glass-panel-sm flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-bold text-slate-800">{v.rewardName}</p>
                  <p className="text-xs text-slate-500">Mostre este código no balcão</p>
                </div>
                <p className="font-mono text-2xl font-bold tracking-[0.2em] text-electric-600">{v.code}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Catálogo */}
      <section className="mb-8">
        <h2 className="mb-1 text-lg font-bold text-slate-800">Prêmios disponíveis</h2>
        {limitReached && (
          <p className="glass-error mb-3 mt-2">
            Você atingiu o limite de {restaurant.maxRedeemsPerMonth} resgates neste mês.
          </p>
        )}
        <div className="mt-3 space-y-3">
          {rewards.length === 0 && <p className="text-sm text-slate-500">O restaurante ainda não cadastrou prêmios.</p>}
          {rewards.map((r) => {
            const missing = r.pointsCost - wallet.balance;
            return (
              <div key={r.id} className="glass-panel-sm flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <h3 className="truncate font-bold text-slate-800">{r.name}</h3>
                  <p className="text-sm font-medium text-electric-600">{formatPoints(r.pointsCost)} pts</p>
                  {missing > 0 && <p className="text-xs text-slate-500">Faltam {formatPoints(missing)} pts</p>}
                </div>
                <RedeemButton rewardId={r.id} name={r.name} disabled={missing > 0 || limitReached} />
              </div>
            );
          })}
        </div>
      </section>

      {/* Histórico */}
      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-800">Histórico</h2>
        <div className="glass-panel-sm divide-y divide-white/60">
          {history.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 p-4 text-sm">
              <div className="min-w-0">
                <p className="truncate text-slate-800">{t.description}</p>
                <p className="text-xs text-slate-500">{day(t.createdAt)}</p>
              </div>
              <span className={`shrink-0 font-bold ${t.type === 'EARN' ? 'text-emerald-600' : 'text-slate-500'}`}>
                {t.type === 'EARN' ? '+' : '−'}{formatPoints(t.points)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-8 text-center text-sm"><Link href="/carteira" className="text-slate-500 underline">Todas as carteiras</Link></p>
    </main>
  );
}
