import Link from 'next/link';
import { AppCampaignStrip } from '@/components/AppCampaignStrip';
import { Brand } from '@/components/Brand';
import { Carousel } from '@/components/Carousel';
import { Icon } from '@/components/Icons';
import { Illustration } from '@/components/Illustrations';
import { IntroSlides } from '@/components/IntroSlides';
import { PlaceAvatar } from '@/components/Visual';
import { campaignsForCustomers } from '@/lib/app-campaigns-db';
import { prisma } from '@/lib/db';
import { affordableRewards, pendingVouchers } from '@/lib/customer-rewards';
import { imageUrl } from '@/lib/images';
import { formatBookingWhen } from '@/lib/booking';
import { formatPoints } from '@/lib/points';
import { requireCustomer } from '@/lib/session';

export const metadata = { title: 'Início' };
export const dynamic = 'force-dynamic';

export default async function CarteiraPage() {
  const customer = await requireCustomer('/carteira');

  const [wallets, vouchers, affordable, nextBooking, appCampaigns] = await Promise.all([
    prisma.wallet.findMany({
      where: { customerId: customer.id },
      include: { restaurant: { select: { id: true, name: true, logoImageId: true, subscriptionStatus: true } } },
      orderBy: { balance: 'desc' },
    }),
    pendingVouchers(customer.id),
    affordableRewards(customer.id, { perPlace: 1 }),
    prisma.booking.findFirst({
      where: { customerId: customer.id, status: { in: ['PENDING', 'CONFIRMED'] }, endsAt: { gt: new Date() } },
      orderBy: { startsAt: 'asc' },
      include: { restaurant: { select: { name: true } } },
    }),
    campaignsForCustomers(),
  ]);
  const total = wallets.reduce((n, w) => n + w.balance, 0);
  // O que está esperando em cada lugar: códigos para retirar e prêmios que já dá para resgatar.
  const toPickUp = new Map<string, number>();
  for (const v of vouchers) toPickUp.set(v.restaurant.id, (toPickUp.get(v.restaurant.id) ?? 0) + 1);
  const canRedeem = new Set(affordable.map((r) => r.place.id));

  return (
    <main className="space-y-7 p-4 sm:p-6 md:pt-8">
      <IntroSlides />

      <header>
        <div className="md:hidden"><Brand href="/carteira" /></div>
        <h1 className="mt-5 text-2xl font-extrabold md:mt-0 md:text-3xl tracking-tight text-primary">Olá, {customer.name.split(' ')[0]}</h1>
        {wallets.length > 0 && (
          <p className="text-sm text-slate-600">
            <span className="font-bold text-primary">{formatPoints(total)} pontos</span> em {wallets.length} {wallets.length === 1 ? 'lugar' : 'lugares'}
          </p>
        )}
      </header>

      {nextBooking && (
        <Link href="/perfil/agendamentos" className="glass-panel card-link flex items-center gap-3 !rounded-[22px] p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E8EEFB] text-electric-600"><Icon name="clock" size={22} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold uppercase tracking-wider text-slate-500">Seu próximo horário</span>
            <span className="block truncate font-bold text-slate-800">{nextBooking.serviceName} · {formatBookingWhen(nextBooking.startsAt)}</span>
            <span className="block truncate text-xs text-slate-500">{nextBooking.restaurant.name}{nextBooking.status === 'PENDING' ? ' · aguardando confirmação' : ''}</span>
          </span>
          <Icon name="chevron" size={18} className="text-slate-400" />
        </Link>
      )}

      <AppCampaignStrip campaigns={appCampaigns} />

      <section aria-labelledby="carteiras">
        <h2 id="carteiras" className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Seus pontos por lugar</h2>
        {wallets.length === 0 ? (
          <div className="glass-panel flex flex-col items-center !rounded-[22px] p-6 text-center">
            <Illustration variant="qr" size={170} />
            <p className="text-lg font-extrabold text-primary">Seu primeiro cartão começa numa compra</p>
            <p className="mb-5 mt-1 max-w-xs text-sm text-slate-600">
              Peça o QR Code no caixa depois de pagar. A carteira de cada lugar aparece aqui sozinha.
            </p>
            <Link href="/lugares" className="glass-button !rounded-full"><Icon name="compass" size={18} /> Explorar lugares</Link>
          </div>
        ) : (
          <Carousel label="Seus pontos por lugar">
            {wallets.map((w) => {
              const pick = toPickUp.get(w.restaurantId) ?? 0;
              const can = canRedeem.has(w.restaurantId);
              return (
                <li key={w.id} className="w-[11.5rem] shrink-0 snap-start">
                  <Link href={`/carteira/${w.restaurantId}`} className="glass-panel card-link flex h-full flex-col items-start gap-2 !rounded-[22px] p-4" aria-label={`${w.restaurant.name}: ${formatPoints(w.balance)} pontos${pick ? `, ${pick} para retirar` : ''}${can ? ', já dá para resgatar' : ''}`}>
                    <PlaceAvatar name={w.restaurant.name} src={imageUrl(w.restaurant.logoImageId)} size={44} />
                    <p className="w-full truncate text-sm font-bold text-slate-900">{w.restaurant.name}</p>
                    <p className="leading-none">
                      <span className="text-2xl font-extrabold text-primary">{formatPoints(w.balance)}</span>
                      <span className="ml-1 text-xs font-semibold text-electric-600">pontos</span>
                    </p>
                    <span className="mt-auto flex min-h-[1.5rem] flex-wrap gap-1.5">
                      {pick > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">{pick} para retirar</span>}
                      {can && <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">Pode resgatar</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </Carousel>
        )}
      </section>

      <Link href="/lugares" className="glass-panel-sm card-link flex items-center gap-3 !rounded-full px-5 py-3">
        <Icon name="compass" size={20} className="shrink-0 text-electric-600" />
        <span className="min-w-0 flex-1 text-sm font-bold text-slate-800">Explorar lugares perto de você</span>
        <Icon name="chevron" size={18} className="text-slate-400" />
      </Link>
    </main>
  );
}
