import Link from 'next/link';
import { customerLogout } from '@/app/actions/customer';
import { Brand } from '@/components/Brand';
import { Icon } from '@/components/Icons';
import { ShareButtons } from '@/components/ShareButtons';
import { PlaceAvatar } from '@/components/Visual';
import { formatPhone, maskCpf } from '@/lib/br';
import { prisma } from '@/lib/db';
import { imageUrl } from '@/lib/images';
import { appUrl } from '@/lib/payments';
import { formatDateTimeBR, formatPoints } from '@/lib/points';
import { requireCustomer } from '@/lib/session';
import { newReferralCode } from '@/lib/tokens';

export const metadata = { title: 'Perfil' };
export const dynamic = 'force-dynamic';

export default async function PerfilPage() {
  const customer = await requireCustomer('/perfil');

  const [wallets, history] = await Promise.all([
    prisma.wallet.findMany({
      where: { customerId: customer.id },
      include: { restaurant: { select: { id: true, name: true, logoImageId: true, referralPoints: true, subscriptionStatus: true } } },
      orderBy: { balance: 'desc' },
    }),
    prisma.transaction.findMany({
      where: { wallet: { customerId: customer.id } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { wallet: { select: { restaurant: { select: { name: true } } } } },
    }),
  ]);

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
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-2xl font-extrabold text-white"
            style={{ background: 'linear-gradient(145deg, #4F8FFF, #1A43C7)' }}
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

      <div className="space-y-6 lg:col-span-2">
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

      <section aria-labelledby="historico" className="lg:col-span-3">
        <h2 id="historico" className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Histórico de pontos</h2>
        {history.length === 0 ? (
          <p className="glass-panel-sm p-4 text-sm text-slate-600">Ainda não há movimentações. Peça o QR Code no caixa depois de pagar.</p>
        ) : (
          <ul className="glass-panel-sm divide-y divide-slate-200/70">
            {history.map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-3 p-4 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800">{t.description}</p>
                  <p className="text-xs text-slate-500">{t.wallet.restaurant.name} · {formatDateTimeBR(t.createdAt)}</p>
                </div>
                <span className={`shrink-0 font-bold ${t.type === 'EARN' ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {t.type === 'EARN' ? '+' : '−'}{formatPoints(t.points)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

    </main>
  );
}
