import Link from 'next/link';
import { Brand } from '@/components/Brand';
import { Icon } from '@/components/Icons';
import { Illustration } from '@/components/Illustrations';
import { IntroSlides } from '@/components/IntroSlides';
import { PlaceAvatar, RewardImage } from '@/components/Visual';
import { prisma } from '@/lib/db';
import { imageUrl } from '@/lib/images';
import { formatPoints } from '@/lib/points';
import { requireCustomer } from '@/lib/session';

export const metadata = { title: 'Início' };
export const dynamic = 'force-dynamic';

export default async function CarteiraPage() {
  const customer = await requireCustomer('/carteira');

  const [wallets, vouchers] = await Promise.all([
    prisma.wallet.findMany({
      where: { customerId: customer.id },
      include: { restaurant: { select: { id: true, name: true, logoImageId: true, subscriptionStatus: true, units: { where: { active: true }, orderBy: { createdAt: 'asc' }, select: { address: true } } } } },
      orderBy: { balance: 'desc' },
    }),
    prisma.redemption.findMany({
      where: { customerId: customer.id, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: { restaurant: { select: { id: true, name: true } } },
    }),
  ]);

  // Prêmios que já cabem no saldo de cada carteira ("o que posso resgatar agora").
  const affordable = (
    await Promise.all(
      wallets
        .filter((w) => w.restaurant.subscriptionStatus === 'ACTIVE' && w.balance > 0)
        .map(async (w) => {
          const rewards = await prisma.reward.findMany({
            where: { restaurantId: w.restaurantId, active: true, pointsCost: { lte: w.balance } },
            orderBy: { pointsCost: 'desc' },
            take: 4,
          });
          return rewards.map((r) => ({ ...r, place: w.restaurant }));
        }),
    )
  )
    .flat()
    .slice(0, 8);

  return (
    <main className="space-y-7 p-4 sm:p-6">
      <IntroSlides />

      <header>
        <Brand href="/carteira" />
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-primary">Olá, {customer.name.split(' ')[0]}</h1>
        <p className="text-sm text-slate-600">Seus pontos e prêmios em um só lugar.</p>
      </header>

      {vouchers.length > 0 && (
        <section aria-labelledby="retirar">
          <h2 id="retirar" className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Prêmios para retirar</h2>
          <ul className="space-y-3">
            {vouchers.map((v) => (
              <li key={v.id}>
                <Link href={`/carteira/${v.restaurant.id}`} className="glass-panel-sm card-link flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-800">{v.rewardName}</p>
                    <p className="truncate text-xs text-slate-500">{v.restaurant.name} · mostre este código no balcão</p>
                  </div>
                  <span className="font-mono text-xl font-bold tracking-[0.18em] text-electric-600">{v.code}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {affordable.length > 0 && (
        <section aria-labelledby="agora">
          <h2 id="agora" className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Você pode resgatar agora</h2>
          <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
            {affordable.map((r) => (
              <li key={r.id} className="w-40 shrink-0">
                <Link href={`/lugar/${r.place.id}/premios`} className="glass-panel-sm card-link block overflow-hidden">
                  <RewardImage src={imageUrl(r.imageId)} name={r.name} className="h-28 w-full" />
                  <div className="space-y-0.5 p-3">
                    <p className="truncate text-sm font-bold text-slate-800">{r.name}</p>
                    <p className="truncate text-xs text-slate-500">{r.place.name}</p>
                    <p className="text-sm font-semibold text-electric-600">{formatPoints(r.pointsCost)} pts</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="carteiras">
        <h2 id="carteiras" className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Suas carteiras</h2>
        {wallets.length === 0 ? (
          <div className="glass-panel flex flex-col items-center p-6 text-center">
            <Illustration variant="qr" size={170} />
            <p className="text-lg font-extrabold text-primary">Seu primeiro cartão começa numa compra</p>
            <p className="mb-5 mt-1 max-w-xs text-sm text-slate-600">
              Peça o QR Code no caixa depois de pagar. A carteira de cada lugar aparece aqui sozinha.
            </p>
            <Link href="/lugares" className="glass-button"><Icon name="compass" size={18} /> Explorar lugares</Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {wallets.map((w) => (
              <li key={w.id}>
                <Link href={`/lugar/${w.restaurantId}`} className="glass-panel card-link flex items-center gap-3.5 p-4">
                  <PlaceAvatar name={w.restaurant.name} src={imageUrl(w.restaurant.logoImageId)} size={52} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-slate-900">{w.restaurant.name}</p>
                    <p className="truncate text-xs text-slate-500">{w.restaurant.units.length > 1 ? `${w.restaurant.units.length} unidades` : w.restaurant.units[0]?.address}</p>
                  </div>
                  <p className="shrink-0 text-right">
                    <span className="block text-2xl font-extrabold leading-none text-primary">{formatPoints(w.balance)}</span>
                    <span className="text-xs font-semibold text-electric-600">pontos</span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
