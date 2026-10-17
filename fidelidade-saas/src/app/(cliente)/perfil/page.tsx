import Link from 'next/link';
import { customerLogout } from '@/app/actions/customer';
import { Brand } from '@/components/Brand';
import { PointsActivity } from '@/components/PointsActivity';
import { ProfilePhoto } from '@/components/ProfilePhoto';
import { Reveal } from '@/components/Reveal';
import { BirthdayCard } from '@/components/BirthdayCard';
import { CopyButton } from '@/components/CopyButton';
import { Icon } from '@/components/Icons';
import { LegalLinks } from '@/components/LegalLinks';
import { ShareButtons } from '@/components/ShareButtons';
import { PlaceAvatar } from '@/components/Visual';
import { formatPhone, maskCpf } from '@/lib/br';
import { prisma } from '@/lib/db';
import { PERIODS, activitySeries, activitySince, type Activity, type Period } from '@/lib/activity';
import { imageUrl, profilePhotoUrl } from '@/lib/images';
import { appUrl } from '@/lib/payments';
import { formatPoints } from '@/lib/points';
import { requireCustomer } from '@/lib/session';
import { ensureAccountCode } from '@/lib/account-code-db';
import { newReferralCode } from '@/lib/tokens';

export const metadata = { title: 'Perfil' };
export const dynamic = 'force-dynamic';

export default async function PerfilPage() {
  const customer = await requireCustomer('/perfil');

  const [wallets, pending, usedCount, acceptors, movements, upcomingBookings, photo, ordersTotal, openOrders] = await Promise.all([
    prisma.wallet.findMany({
      where: { customerId: customer.id },
      include: { restaurant: { select: { id: true, name: true, logoImageId: true, referralPoints: true, subscriptionStatus: true, pointsShareOut: true } } },
      orderBy: { balance: 'desc' },
    }),
    prisma.redemption.count({ where: { customerId: customer.id, status: 'PENDING' } }),
    prisma.redemption.count({ where: { customerId: customer.id, status: 'USED' } }),
    prisma.restaurant.findMany({
      where: { subscriptionStatus: 'ACTIVE', listed: true, pointsAcceptIn: true },
      select: { id: true, name: true, logoImageId: true },
      orderBy: { name: 'asc' },
      take: 12,
    }),
    prisma.transaction.findMany({
      where: { wallet: { customerId: customer.id }, type: { in: ['EARN', 'REDEEM'] }, createdAt: { gte: activitySince() } },
      select: { createdAt: true, type: true, points: true },
      orderBy: { createdAt: 'desc' },
      take: 3000,
    }),
    prisma.booking.count({ where: { customerId: customer.id, status: { in: ['PENDING', 'CONFIRMED'] }, endsAt: { gt: new Date() } } }),
    prisma.customerPhoto.findUnique({ where: { customerId: customer.id }, select: { updatedAt: true } }),
    prisma.order.count({ where: { customerId: customer.id } }),
    prisma.order.count({ where: { customerId: customer.id, status: { in: ['RECEIVED', 'PREPARING', 'READY'] } } }),
  ]);
  const rows = movements.map((m) => ({ at: m.createdAt, type: m.type as 'EARN' | 'REDEEM', points: m.points }));
  const activity = Object.fromEntries(PERIODS.map((p) => [p, activitySeries(rows, p)])) as Record<Period, Activity>;
  const balance = wallets.reduce((n, w) => n + w.balance, 0);

  let code = customer.referralCode;
  if (!code) {
    code = newReferralCode();
    await prisma.customer.update({ where: { id: customer.id }, data: { referralCode: code } }).catch(() => {});
  }
  const accountCode = await ensureAccountCode(customer);
  const invites = wallets.filter((w) => w.restaurant.subscriptionStatus === 'ACTIVE' && w.restaurant.referralPoints > 0);

  return (
    <main className="space-y-6 p-4 sm:p-6 md:pt-8 lg:grid lg:grid-cols-5 lg:items-start lg:gap-6 lg:space-y-0">
      <Reveal as="header" from="top" className="lg:col-span-5">
        <div className="md:hidden"><Brand href="/carteira" /></div>
        <ProfilePhoto name={customer.name} photoUrl={profilePhotoUrl(photo?.updatedAt)}>
          <h1 className="truncate text-2xl font-extrabold tracking-tight text-primary">{customer.name}</h1>
          <p className="text-sm text-slate-500">CPF {maskCpf(customer.cpf)} · {formatPhone(customer.phone)}</p>
        </ProfilePhoto>
      </Reveal>

      <Reveal from="zoom" className="lg:col-span-5">
      <section aria-labelledby="id-conta" className="flex items-center gap-3 rounded-[22px] bg-[#0F1F3D] p-4 text-white" data-testid="account-id">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-lima text-primary"><Icon name="user" size={22} /></span>
        <div className="min-w-0 flex-1">
          <h2 id="id-conta" className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">ID da sua conta</h2>
          <p className="whitespace-nowrap font-mono text-xl font-bold tracking-[0.12em] text-lima" data-testid="account-id-code">{accountCode}</p>
          <p className="text-xs text-white/70">Informe no caixa no lugar do CPF para receber seus pontos.</p>
        </div>
        <CopyButton text={accountCode} label="Copiar" />
      </section>
      </Reveal>

      <Reveal from="zoom" className="lg:col-span-5">
      <section aria-labelledby="atividade">
        <h2 id="atividade" className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Seus pontos</h2>
        <PointsActivity data={activity} balance={balance} places={wallets.length} />
      </section>
      </Reveal>

      <div className="space-y-6 lg:order-2 lg:col-span-3">
        <Reveal from="left">
        <section aria-labelledby="atalhos">
          <h2 id="atalhos" className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Seu movimento</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/perfil/pontos" className="glass-panel-sm card-link flex items-center gap-3 p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#E8EEFB] text-electric-600"><Icon name="receipt" size={22} /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-slate-800">Histórico de pontos</span>
                <span className="block text-xs text-slate-500">Tudo o que você ganhou e usou</span>
              </span>
              <Icon name="chevron" size={18} className="text-slate-400" />
            </Link>
            {ordersTotal > 0 && (
              <Link href="/perfil/pedidos" className="glass-panel-sm card-link flex items-center gap-3 p-4" data-testid="my-orders-link">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#E8EEFB] text-electric-600"><Icon name="bag" size={22} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-slate-800">Meus pedidos</span>
                  <span className="block text-xs text-slate-500">{openOrders > 0 ? `${openOrders} ${openOrders === 1 ? 'pedido em andamento' : 'pedidos em andamento'}` : 'Veja o que você já pediu'}</span>
                </span>
                <Icon name="chevron" size={18} className="text-slate-400" />
              </Link>
            )}
            <Link href="/perfil/agendamentos" className="glass-panel-sm card-link flex items-center gap-3 p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#E8EEFB] text-electric-600"><Icon name="clock" size={22} /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-slate-800">Meus agendamentos</span>
                <span className="block text-xs text-slate-500">{upcomingBookings > 0 ? `${upcomingBookings} ${upcomingBookings === 1 ? 'horário marcado' : 'horários marcados'}` : 'Marque um horário nos lugares'}</span>
              </span>
              <Icon name="chevron" size={18} className="text-slate-400" />
            </Link>
            <Link href="/perfil/premios" className="glass-panel-sm card-link flex items-center gap-3 p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#E8EEFB] text-electric-600"><Icon name="gift" size={22} /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-slate-800">Meus prêmios</span>
                <span className="block text-xs text-slate-500">
                  {pending > 0 ? `${pending} para retirar · ` : ''}{usedCount} já resgatado{usedCount === 1 ? '' : 's'}
                </span>
              </span>
              <Icon name="chevron" size={18} className="text-slate-400" />
            </Link>
          </div>
        </section>
        </Reveal>

        <Reveal from="bottom">
        <BirthdayCard initial={customer.birthDay != null && customer.birthMonth != null ? { day: customer.birthDay, month: customer.birthMonth } : null} />
        </Reveal>

        <Reveal from="bottom">
        <section aria-labelledby="compartilhados">
          <h2 id="compartilhados" className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Pontos compartilhados</h2>
          <div className="glass-panel-sm space-y-4 p-4">
            <p className="text-sm text-slate-600">
              Alguns lugares deixam você usar os pontos ganhos neles em outros lugares do clube. Os demais têm carteira individual: os pontos só valem lá.
            </p>
            {wallets.length === 0 ? (
              <p className="text-sm text-slate-500">Quando você tiver uma carteira, mostramos aqui se ela é compartilhada ou individual.</p>
            ) : (
              <ul className="divide-y divide-slate-200/70">
                {wallets.map((w) => (
                  <li key={w.id} className="flex items-center gap-3 py-2.5">
                    <PlaceAvatar name={w.restaurant.name} src={imageUrl(w.restaurant.logoImageId)} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{w.restaurant.name}</p>
                      <p className="text-xs text-slate-500">{formatPoints(w.balance)} pontos</p>
                    </div>
                    <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${w.restaurant.pointsShareOut ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {w.restaurant.pointsShareOut ? 'Compartilhada' : 'Individual'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Lugares que aceitam pontos de outros</p>
              {acceptors.length === 0 ? (
                <p className="text-sm text-slate-500">Ainda nenhum lugar aceita pontos de outros. Assim que algum aceitar, ele aparece aqui.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {acceptors.map((a) => (
                    <li key={a.id}>
                      <Link href={`/lugar/${a.id}`} className="chip-link gap-2 !py-1">
                        <PlaceAvatar name={a.name} src={imageUrl(a.logoImageId)} size={20} />
                        {a.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-slate-500">Nesses lugares, na hora de montar a sacola de prêmios, você pode completar o que faltar com os pontos das carteiras compartilhadas. O valor é convertido de um lugar para o outro.</p>
            </div>
          </div>
        </section>
        </Reveal>
      </div>

      <div className="space-y-6 lg:order-1 lg:col-span-2">
      <Reveal from="right">
      <section aria-labelledby="indique">
        <h2 id="indique" className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Indique amigos</h2>
        {invites.length === 0 ? (
          <p className="glass-panel-sm p-4 text-sm text-slate-600">
            Quando você tiver pontos em um lugar que premia indicações, o seu link de convite aparece aqui.
          </p>
        ) : (
          <ul className="space-y-3">
            {invites.map((w) => (
              <li key={w.id} className="glass-panel-sm space-y-3 p-4">
                <div className="flex items-center gap-3">
                  <PlaceAvatar name={w.restaurant.name} src={imageUrl(w.restaurant.logoImageId)} size={44} />
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-800">{w.restaurant.name}</p>
                    <p className="text-xs text-slate-500">Ganhe +{formatPoints(w.restaurant.referralPoints)} pts quando seu amigo fizer a primeira compra</p>
                  </div>
                </div>
                <ShareButtons url={`${appUrl()}/convite/${w.restaurant.id}/${code}`} text={`Entra no clube de pontos do ${w.restaurant.name} comigo e ganhe prêmios:`} />
              </li>
            ))}
          </ul>
        )}
      </section>
      </Reveal>

      <Reveal from="bottom" delay={80}>
      <section className="space-y-3">
        <Link href="/lugares" className="glass-button-ghost"><Icon name="compass" size={18} /> Explorar lugares</Link>
        <form action={customerLogout}>
          <button className="btn-danger">Sair da conta</button>
        </form>
      </section>
      </Reveal>
      <LegalLinks audience="cliente" className="pt-2" />
      </div>
    </main>
  );
}
