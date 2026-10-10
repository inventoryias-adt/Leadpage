import Link from 'next/link';
import { customerLogout } from '@/app/actions/customer';
import { Brand } from '@/components/Brand';
import { PointsActivity } from '@/components/PointsActivity';
import { Icon } from '@/components/Icons';
import { ShareButtons } from '@/components/ShareButtons';
import { PlaceAvatar } from '@/components/Visual';
import { formatPhone, maskCpf } from '@/lib/br';
import { prisma } from '@/lib/db';
import { PERIODS, activitySeries, activitySince, type Activity, type Period } from '@/lib/activity';
import { imageUrl } from '@/lib/images';
import { appUrl } from '@/lib/payments';
import { formatPoints } from '@/lib/points';
import { requireCustomer } from '@/lib/session';
import { newReferralCode } from '@/lib/tokens';

export const metadata = { title: 'Perfil' };
export const dynamic = 'force-dynamic';

export default async function PerfilPage() {
  const customer = await requireCustomer('/perfil');

  const [wallets, pending, usedCount, acceptors, movements] = await Promise.all([
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
      where: { wallet: { customerId: customer.id }, createdAt: { gte: activitySince() } },
      select: { createdAt: true, type: true, points: true },
      orderBy: { createdAt: 'desc' },
      take: 3000,
    }),
  ]);
  const rows = movements.map((m) => ({ at: m.createdAt, type: m.type, points: m.points }));
  const activity = Object.fromEntries(PERIODS.map((p) => [p, activitySeries(rows, p)])) as Record<Period, Activity>;
  const balance = wallets.reduce((n, w) => n + w.balance, 0);

  let code = customer.referralCode;
  if (!code) {
    code = newReferralCode();
    await prisma.customer.update({ where: { id: customer.id }, data: { referralCode: code } }).catch(() => {});
  }
  const invites = wallets.filter((w) => w.restaurant.subscriptionStatus === 'ACTIVE' && w.restaurant.referralPoints > 0);

  return (
    <main className="space-y-6 p-4 sm:p-6 md:pt-8 lg:grid lg:grid-cols-5 lg:items-start lg:gap-6 lg:space-y-0">
      <header className="lg:col-span-5">
        <div className="md:hidden"><Brand href="/carteira" /></div>
        <div className="mt-5 flex items-center gap-4">
          <span
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg text-2xl font-semibold text-white"
            style={{ background: '#0F1F3D' }}
            aria-hidden
          >
            {customer.name.trim().charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-extrabold tracking-tight text-primary">{customer.name}</h1>
            <p className="text-sm text-slate-500">CPF {maskCpf(customer.cpf)} · {formatPhone(customer.phone)}</p>
          </div>
        </div>
      </header>

      <section aria-labelledby="atividade" className="lg:col-span-5">
        <h2 id="atividade" className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Seus pontos</h2>
        <PointsActivity data={activity} balance={balance} places={wallets.length} />
      </section>

      <div className="space-y-6 lg:order-2 lg:col-span-3">
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
              <p className="mt-3 text-xs text-slate-500">Em breve você poderá trocar pontos de carteiras compartilhadas nesses lugares.</p>
            </div>
          </div>
        </section>
      </div>

      <div className="space-y-6 lg:order-1 lg:col-span-2">
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

      <section className="space-y-3">
        <Link href="/lugares" className="glass-button-ghost"><Icon name="compass" size={18} /> Explorar lugares</Link>
        <form action={customerLogout}>
          <button className="btn-danger">Sair da conta</button>
        </form>
      </section>
      </div>
    </main>
  );
}
