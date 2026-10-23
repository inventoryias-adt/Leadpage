import Link from 'next/link';
import { AppCampaignStrip } from '@/components/AppCampaignStrip';
import { BirthdayBanner } from '@/components/BirthdayBanner';
import { Brand } from '@/components/Brand';
import { Carousel } from '@/components/Carousel';
import { Icon } from '@/components/Icons';
import { IndicacoesShelf } from '@/components/IndicacoesShelf';
import { Illustration } from '@/components/Illustrations';
import { Reveal } from '@/components/Reveal';
import { IntroSlides } from '@/components/IntroSlides';
import { NextBookingCard } from '@/components/NextBookingCard';
import { ShortcutTiles } from '@/components/Shortcuts';
import { PlaceAvatar, ProgressBar, RewardImage } from '@/components/Visual';
import { campaignsForCustomers } from '@/lib/app-campaigns-db';
import { isBirthdayToday } from '@/lib/birthday-perk';
import { perkPlaces } from '@/lib/birthday-perk-db';
import { prisma } from '@/lib/db';
import { affordableRewards, pendingVouchers } from '@/lib/customer-rewards';
import { imageUrl } from '@/lib/images';
import { categoryLabel } from '@/lib/categories';
import { isOpenNow, parseSchedule } from '@/lib/hours';
import { agoText } from '@/lib/interaction-approval';
import { formatPoints, startOfMonthBR } from '@/lib/points';
import { requireCustomer } from '@/lib/session';

export const metadata = { title: 'Início' };
export const dynamic = 'force-dynamic';

export default async function CarteiraPage() {
  const customer = await requireCustomer('/carteira');

  const birthday = isBirthdayToday(customer);
  const perks = birthday ? await perkPlaces() : [];
  const [wallets, vouchers, affordable, nextBooking, appCampaigns, upcomingBookings, openOrders] = await Promise.all([
    prisma.wallet.findMany({
      where: { customerId: customer.id },
      include: { restaurant: { select: { id: true, name: true, logoImageId: true, subscriptionStatus: true, category: true, categoryOther: true, units: { where: { active: true }, select: { openingSchedule: true } } } } },
      orderBy: { balance: 'desc' },
    }),
    pendingVouchers(customer.id),
    affordableRewards(customer.id, { perPlace: 1 }),
    prisma.booking.findFirst({
      where: { customerId: customer.id, status: { in: ['PENDING', 'CONFIRMED'] }, endsAt: { gt: new Date() } },
      orderBy: { startsAt: 'asc' },
      include: { restaurant: { select: { name: true } }, resource: { select: { name: true } } },
    }),
    campaignsForCustomers(),
    prisma.booking.count({ where: { customerId: customer.id, status: { in: ['PENDING', 'CONFIRMED'] }, endsAt: { gt: new Date() } } }),
    prisma.order.count({ where: { customerId: customer.id, status: { in: ['RECEIVED', 'PREPARING', 'READY'] } } }),
  ]);
  // Próximo prêmio de cada lugar: o mais barato que ainda não dá para resgatar (para mostrar "faltam N pontos").
  const rewardRows = wallets.length
    ? await prisma.reward.findMany({ where: { restaurantId: { in: wallets.map((w) => w.restaurantId) }, active: true, birthdayOnly: false }, select: { restaurantId: true, name: true, pointsCost: true }, orderBy: { pointsCost: 'asc' } })
    : [];
  const nextGoal = (restaurantId: string, balance: number) => rewardRows.find((r) => r.restaurantId === restaurantId && r.pointsCost > balance) ?? null;
  const total = wallets.reduce((n, w) => n + w.balance, 0);
  // Números do cartão de resumo e a atividade recente (últimas movimentações em todos os lugares).
  const [earnedMonth, recent] = wallets.length
    ? await Promise.all([
        prisma.transaction.aggregate({ where: { walletId: { in: wallets.map((w) => w.id) }, type: 'EARN', createdAt: { gte: startOfMonthBR() } }, _sum: { points: true } }),
        prisma.transaction.findMany({ where: { walletId: { in: wallets.map((w) => w.id) }, type: { in: ['EARN', 'REDEEM'] } }, orderBy: { createdAt: 'desc' }, take: 4, select: { id: true, type: true, points: true, description: true, createdAt: true, wallet: { select: { restaurant: { select: { name: true } } } } } }),
      ])
    : [null, []];
  const placeStatus = (w: (typeof wallets)[number]) => {
    const schedules = w.restaurant.units.map((u) => parseSchedule(u.openingSchedule)).filter((x): x is NonNullable<typeof x> => !!x);
    if (schedules.length === 0) return null;
    return schedules.some((sc) => isOpenNow(sc)) ? 'Aberto agora' : 'Fechado agora';
  };
  // O que está esperando em cada lugar: códigos para retirar e prêmios que já dá para resgatar.
  const toPickUp = new Map<string, number>();
  for (const v of vouchers) toPickUp.set(v.restaurant.id, (toPickUp.get(v.restaurant.id) ?? 0) + 1);
  const canRedeem = new Set(affordable.map((r) => r.place.id));

  return (
    <main className="space-y-7 p-4 sm:p-6 md:pt-8">
      <IntroSlides />

      <Reveal as="header" from="top">
        <div className="md:hidden"><Brand href="/carteira" /></div>
        <h1 className="mt-5 text-2xl font-extrabold md:mt-0 md:text-3xl tracking-tight text-primary">Olá, {customer.name.split(' ')[0]}</h1>
        {wallets.length > 0 && (
          <p className="text-sm text-slate-600">
            <span className="mark-lime font-bold text-primary">{formatPoints(total)} pontos</span> em {wallets.length} {wallets.length === 1 ? 'lugar' : 'lugares'}
          </p>
        )}
      </Reveal>

      {birthday && <Reveal from="zoom"><BirthdayBanner name={customer.name.split(' ')[0]} places={perks} showList /></Reveal>}

      {wallets.length > 0 && (
        <Reveal from="zoom">
          <section aria-label="Resumo" className="grid grid-cols-2 gap-3" data-testid="home-summary">
            <Link href="/perfil/pontos" className="card-link col-span-2 flex items-center gap-4 rounded-[22px] bg-[#0F1F3D] p-4 text-white shadow-[0_10px_26px_rgba(15,31,61,.25)]">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-lima text-primary"><Icon name="star" size={24} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">Saldo total</span>
                <span className="block text-3xl font-extrabold leading-tight text-lima">{formatPoints(total)} <span className="text-sm font-semibold text-white/70">pontos</span></span>
              </span>
              <span className="chip-lima shrink-0">+{formatPoints(earnedMonth?._sum.points ?? 0)} no mês</span>
            </Link>
            {[
              { href: '/perfil/premios?aba=disponiveis', icon: 'gift' as const, n: affordable.length, label: affordable.length === 1 ? 'Prêmio ao alcance' : 'Prêmios ao alcance' },
              { href: '/perfil/premios?aba=retirar', icon: 'receipt' as const, n: vouchers.length, label: vouchers.length === 1 ? 'Cupom a retirar' : 'Cupons a retirar' },
            ].map((t) => (
              <Link key={t.label} href={t.href} className="glass-panel card-link flex items-center gap-3 !rounded-[20px] p-3.5">
                <span className="icon-tile"><Icon name={t.icon} size={20} /></span>
                <span><span className="block text-2xl font-extrabold leading-none text-primary">{t.n}</span><span className="block text-xs font-semibold text-slate-500">{t.label}</span></span>
              </Link>
            ))}
          </section>
        </Reveal>
      )}

      <Reveal from="bottom" delay={60}>
      <section aria-labelledby="carteiras">
        <h2 id="carteiras" className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Suas carteiras</h2>
        {wallets.length === 0 ? (
          <div className="glass-panel flex flex-col items-center !rounded-[22px] p-6 text-center">
            <Illustration variant="qr" size={170} />
            <p className="text-lg font-extrabold text-primary">Seu primeiro cartão começa numa compra</p>
            <p className="mb-5 mt-1 max-w-xs text-sm text-slate-600">
              Depois de pagar, informe o seu CPF no caixa ou leia o QR Code. A carteira de cada lugar aparece aqui sozinha.
            </p>
            <Link href="/lugares" className="glass-button !rounded-full"><Icon name="compass" size={18} /> Explorar lugares</Link>
          </div>
        ) : (
          <Carousel label="Suas carteiras">
            {wallets.map((w) => {
              const pick = toPickUp.get(w.restaurantId) ?? 0;
              const can = canRedeem.has(w.restaurantId);
              const goal = nextGoal(w.restaurantId, w.balance);
              return (
                <li key={w.id} className={wallets.length === 1 ? 'w-full' : 'w-[13rem] shrink-0 snap-start'}>
                  <Link href={`/carteira/${w.restaurantId}`} className="glass-panel card-link flex h-full flex-col items-start gap-2 !rounded-[22px] p-4" aria-label={`${w.restaurant.name}: ${formatPoints(w.balance)} pontos${pick ? `, ${pick} para retirar` : ''}${can ? ', já dá para resgatar' : ''}`}>
                    <span className="flex w-full items-center gap-2.5">
                      <PlaceAvatar name={w.restaurant.name} src={imageUrl(w.restaurant.logoImageId)} size={44} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-slate-900">{w.restaurant.name}</span>
                        <span className="block truncate text-xs text-slate-500">
                          {[categoryLabel(w.restaurant.category, w.restaurant.categoryOther)].filter(Boolean).join('')}
                          {placeStatus(w) && <>{categoryLabel(w.restaurant.category, w.restaurant.categoryOther) ? ' · ' : ''}<span className={placeStatus(w) === 'Aberto agora' ? 'font-semibold text-emerald-700' : ''}>{placeStatus(w)?.toLowerCase()}</span></>}
                        </span>
                      </span>
                    </span>
                    <p className="leading-none">
                      <span className="text-3xl font-extrabold text-primary">{formatPoints(w.balance)}</span>
                      <span className="ml-1 text-xs font-semibold text-electric-600">pontos</span>
                    </p>
                    {goal && (
                      <span className="block w-full">
                        <ProgressBar value={w.balance} max={goal.pointsCost} label={`Progresso para ${goal.name}`} />
                        <span className="mt-1.5 block text-xs text-slate-500">Faltam <b className="text-slate-700">{formatPoints(goal.pointsCost - w.balance)}</b> para {goal.name}</span>
                      </span>
                    )}
                    <span className="mt-auto flex min-h-[1.5rem] flex-wrap gap-1.5">
                      {pick > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">{pick} para retirar</span>}
                      {can && <span className="rounded-full bg-lima px-2.5 py-0.5 text-[11px] font-bold text-primary">Pode resgatar</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </Carousel>
        )}
      </section>
      </Reveal>

      {nextBooking && <Reveal from="left"><NextBookingCard booking={nextBooking} /></Reveal>}

      {affordable.length > 0 && (
        <Reveal from="bottom">
          <section aria-labelledby="alcance">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 id="alcance" className="text-xs font-bold uppercase tracking-wider text-slate-500">Prêmios ao seu alcance</h2>
              <Link href="/perfil/premios?aba=disponiveis" className="text-xs font-bold text-electric-600">Ver todos</Link>
            </div>
            <ul className="glass-panel divide-y divide-slate-100 !rounded-[20px]">
              {affordable.slice(0, 3).map((r) => (
                <li key={r.id}>
                  <Link href={`/lugar/${r.place.id}/premios`} className="card-link flex items-center gap-3 px-4 py-3">
                    <RewardImage src={imageUrl(r.imageId)} name={r.name} className="h-12 w-12 shrink-0 rounded-xl" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold text-slate-800">{r.name}</span>
                      <span className="block truncate text-xs text-slate-500">{r.place.name}</span>
                    </span>
                    <span className="chip-lima shrink-0">{formatPoints(r.pointsCost)} pts</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </Reveal>
      )}

      {appCampaigns.length > 0 && <Reveal from="right"><AppCampaignStrip campaigns={appCampaigns} /></Reveal>}

      {recent.length > 0 && (
        <Reveal from="bottom">
          <section aria-labelledby="atividade-recente">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 id="atividade-recente" className="text-xs font-bold uppercase tracking-wider text-slate-500">Atividade recente</h2>
              <Link href="/perfil/pontos" className="text-xs font-bold text-electric-600">Ver histórico</Link>
            </div>
            <ul className="glass-panel divide-y divide-slate-100 !rounded-[20px]">
              {recent.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={t.type === 'EARN' ? { background: '#E6F7EC', color: '#15803D' } : { background: '#FFEFE3', color: '#C2410C' }}>
                    <Icon name={t.type === 'EARN' ? 'star' : 'gift'} size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-800">{t.description}</span>
                    <span className="block truncate text-xs text-slate-500">{t.wallet.restaurant.name} · {agoText(t.createdAt)}</span>
                  </span>
                  <span className={`shrink-0 text-sm font-extrabold ${t.type === 'EARN' ? 'text-emerald-700' : 'text-orange-700'}`}>{t.type === 'EARN' ? '+' : '−'}{formatPoints(t.points)}</span>
                </li>
              ))}
            </ul>
          </section>
        </Reveal>
      )}

      <Reveal from="bottom"><IndicacoesShelf customerId={customer.id} hasWallets={wallets.length > 0} /></Reveal>

      <Reveal from="zoom">
      <Link href="/lugares" className="glass-panel-sm card-link flex items-center gap-3 !rounded-full px-5 py-3">
        <Icon name="compass" size={20} className="shrink-0 text-electric-600" />
        <span className="min-w-0 flex-1 text-sm font-bold text-slate-800">Explorar lugares perto de você</span>
        <Icon name="chevron" size={18} className="text-slate-400" />
      </Link>
      </Reveal>

      <Reveal from="bottom">
        <section aria-labelledby="atalhos-inicio">
          <h2 id="atalhos-inicio" className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Atalhos</h2>
          <ShortcutTiles
            items={[
              { href: '/perfil/pontos', icon: 'receipt', label: 'Histórico' },
              { href: '/perfil/premios', icon: 'gift', label: 'Prêmios', count: vouchers.length },
              { href: '/perfil/pedidos', icon: 'bag', label: 'Pedidos', count: openOrders },
              { href: '/perfil/agendamentos', icon: 'clock', label: 'Horários', count: upcomingBookings },
            ]}
          />
        </section>
      </Reveal>
    </main>
  );
}
