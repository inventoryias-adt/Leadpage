import Link from 'next/link';
import { Brand } from '@/components/Brand';
import { Icon } from '@/components/Icons';
import { Illustration } from '@/components/Illustrations';
import { IntroSlides } from '@/components/IntroSlides';
import { PlaceAvatar, RewardImage } from '@/components/Visual';
import { prisma } from '@/lib/db';
import { affordableRewards, nextReward, pendingVouchers } from '@/lib/customer-rewards';
import { imageUrl } from '@/lib/images';
import { formatPoints, formatPrice } from '@/lib/points';
import { requireCustomer } from '@/lib/session';

export const metadata = { title: 'Início' };
export const dynamic = 'force-dynamic';

export default async function CarteiraPage() {
  const customer = await requireCustomer('/carteira');

  const [wallets, vouchers, affordable, next, places] = await Promise.all([
    prisma.wallet.findMany({
      where: { customerId: customer.id },
      include: { restaurant: { select: { id: true, name: true, logoImageId: true, subscriptionStatus: true } } },
      orderBy: { balance: 'desc' },
    }),
    pendingVouchers(customer.id),
    affordableRewards(customer.id, { perPlace: 4 }),
    nextReward(customer.id),
    prisma.restaurant.count({ where: { subscriptionStatus: 'ACTIVE', listed: true } }),
  ]);
  const total = wallets.reduce((n, w) => n + w.balance, 0);

  return (
    <main className="space-y-7 p-4 sm:p-6 md:pt-8">
      <IntroSlides />

      <header>
        <div className="md:hidden"><Brand href="/carteira" /></div>
        <h1 className="mt-5 text-2xl font-extrabold md:mt-0 md:text-3xl tracking-tight text-primary">Olá, {customer.name.split(' ')[0]}</h1>
        <p className="text-sm text-slate-600">Seus pontos e prêmios em um só lugar.</p>
      </header>

      <section aria-labelledby="carteiras">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="carteiras" className="text-xs font-bold uppercase tracking-wider text-slate-500">Suas carteiras</h2>
          {wallets.length > 0 && (
            <p className="text-xs font-semibold text-slate-500">
              {wallets.length} {wallets.length === 1 ? 'lugar' : 'lugares'} · <span className="text-primary">{formatPoints(total)} pts</span>
            </p>
          )}
        </div>
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
          <ul className="card-row">
            {wallets.map((w) => (
              <li key={w.id}>
                <Link href={`/lugar/${w.restaurantId}`} className="glass-panel card-link flex h-full flex-col items-start gap-2 p-3.5">
                  <PlaceAvatar name={w.restaurant.name} src={imageUrl(w.restaurant.logoImageId)} size={40} />
                  <p className="w-full truncate text-sm font-bold text-slate-900">{w.restaurant.name}</p>
                  <p className="leading-none">
                    <span className="text-2xl font-extrabold text-primary">{formatPoints(w.balance)}</span>
                    <span className="ml-1 text-xs font-semibold text-electric-600">pontos</span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="dicas" className="grid gap-3 md:grid-cols-2">
        <h2 id="dicas" className="sr-only">Vantagens de usar seus pontos</h2>
        <div className="glass-panel-sm flex flex-col gap-1 p-4">
          <span className="mb-1 flex h-9 w-9 items-center justify-center rounded-lg bg-[#E8EEFB] text-electric-600"><Icon name="spark" size={19} /></span>
          {wallets.length === 0 ? (
            <>
              <p className="font-bold text-slate-800">Já pensou quanto você pode economizar com pontos?</p>
              <p className="text-sm text-slate-600">Cada compra vira pontos e os pontos viram prêmios. Peça o QR Code no caixa depois de pagar.</p>
            </>
          ) : affordable.length > 0 ? (
            <>
              <p className="font-bold text-slate-800">Já usou seus pontos hoje?</p>
              <p className="text-sm text-slate-600">Você já pode trocar seus pontos por {affordable.length >= 4 ? 'vários prêmios' : affordable.length === 1 ? '1 prêmio' : `${affordable.length} prêmios`}.</p>
              <Link href="/perfil/premios?aba=disponiveis" className="link-inline mt-1 inline-flex items-center gap-1 text-sm">Ver o que posso resgatar <Icon name="chevron" size={14} /></Link>
            </>
          ) : next ? (
            <>
              <p className="font-bold text-slate-800">Falta pouco!</p>
              <p className="text-sm text-slate-600">Faltam {formatPoints(next.missing)} pontos para {next.reward.name} no {next.place.name}.</p>
              <Link href={`/lugar/${next.place.id}/premios`} className="link-inline mt-1 inline-flex items-center gap-1 text-sm">Ver os prêmios <Icon name="chevron" size={14} /></Link>
            </>
          ) : (
            <>
              <p className="font-bold text-slate-800">Seus pontos trabalham por você</p>
              <p className="text-sm text-slate-600">Continue comprando: cada compra aproxima o próximo prêmio.</p>
            </>
          )}
        </div>
        <div className="glass-panel-sm flex flex-col gap-1 p-4">
          <span className="mb-1 flex h-9 w-9 items-center justify-center rounded-lg bg-[#E8EEFB] text-electric-600"><Icon name="compass" size={19} /></span>
          <p className="font-bold text-slate-800">Veja o que te espera em Lugares</p>
          <p className="text-sm text-slate-600">
            {places > 0 ? `${places} ${places === 1 ? 'lugar participa' : 'lugares participam'} do clube` : 'Os lugares do clube'} com prêmios, campanhas e desafios para você.
          </p>
          <Link href="/lugares" className="link-inline mt-1 inline-flex items-center gap-1 text-sm">Explorar lugares <Icon name="chevron" size={14} /></Link>
        </div>
      </section>

      {vouchers.length > 0 && (
        <section aria-labelledby="retirar">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 id="retirar" className="text-xs font-bold uppercase tracking-wider text-slate-500">Prêmios para retirar</h2>
            {vouchers.length > 3 && <Link href="/perfil/premios?aba=retirar" className="link-inline text-xs">Ver todos ({vouchers.length})</Link>}
          </div>
          <ul className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
            {vouchers.slice(0, 3).map((v) => (
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
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 id="agora" className="text-xs font-bold uppercase tracking-wider text-slate-500">Você pode resgatar agora</h2>
            <Link href="/perfil/premios?aba=disponiveis" className="link-inline text-xs">Ver todos</Link>
          </div>
          <ul className="card-row">
            {affordable.slice(0, 6).map((r) => (
              <li key={r.id}>
                <Link href={`/lugar/${r.place.id}/premios`} className="glass-panel-sm card-link block overflow-hidden">
                  <RewardImage src={imageUrl(r.imageId)} name={r.name} className="h-28 w-full" />
                  <div className="space-y-0.5 p-3">
                    <p className="truncate text-sm font-bold text-slate-800">{r.name}</p>
                    <p className="truncate text-xs text-slate-500">{r.place.name}</p>
                    <p className="text-sm font-semibold text-electric-600">{formatPrice(r.pointsCost, r.cashCents)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
