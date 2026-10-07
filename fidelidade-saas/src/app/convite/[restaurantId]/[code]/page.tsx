import Link from 'next/link';
import { CustomerAuthForm } from '@/components/AuthForms';
import { Brand } from '@/components/Brand';
import { Icon } from '@/components/Icons';
import { PlaceAvatar } from '@/components/Visual';
import { prisma } from '@/lib/db';
import { imageUrl } from '@/lib/images';
import { formatPoints } from '@/lib/points';
import { getCustomer } from '@/lib/session';

export const metadata = { title: 'Convite' };
export const dynamic = 'force-dynamic';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-5">
      <div className="glass-panel w-full max-w-md p-7">
        <div className="mb-5 flex justify-center"><Brand href="/entrar" /></div>
        {children}
      </div>
    </main>
  );
}

export default async function ConvitePage({ params }: { params: Promise<{ restaurantId: string; code: string }> }) {
  const { restaurantId, code } = await params;
  const valid = /^[0-9a-f-]{36}$/.test(restaurantId) && /^[A-Z0-9]{8}$/.test(code);

  const [restaurant, referrer, customer] = valid
    ? await Promise.all([
        prisma.restaurant.findUnique({
          where: { id: restaurantId },
          select: { id: true, name: true, address: true, logoImageId: true, referralPoints: true, subscriptionStatus: true, pointsPerReal: true },
        }),
        prisma.customer.findUnique({ where: { referralCode: code }, select: { name: true } }),
        getCustomer(),
      ])
    : [null, null, null];

  if (!restaurant || restaurant.subscriptionStatus !== 'ACTIVE' || !referrer) {
    return (
      <Shell>
        <h1 className="mb-2 text-center text-xl font-bold text-primary">Convite inválido</h1>
        <p className="mb-5 text-center text-slate-600">Confira o link com quem te enviou, ou explore os lugares do Fidelize.</p>
        <Link href="/lugares" className="glass-button">Ver lugares</Link>
      </Shell>
    );
  }

  const friend = referrer.name.split(' ')[0];
  return (
    <Shell>
      <div className="mb-4 flex flex-col items-center text-center">
        <PlaceAvatar name={restaurant.name} src={imageUrl(restaurant.logoImageId)} size={72} />
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-primary">{friend} te convidou!</h1>
        <p className="mt-1 text-slate-600">Entre no clube de pontos do <strong>{restaurant.name}</strong> e troque suas compras por prêmios.</p>
      </div>

      <ul className="mb-6 space-y-2 text-sm text-slate-700">
        <li className="flex items-center gap-2.5"><Icon name="check" size={18} className="text-emerald-600" /> {restaurant.pointsPerReal} pontos a cada R$ 1 gasto</li>
        <li className="flex items-center gap-2.5"><Icon name="check" size={18} className="text-emerald-600" /> Sem baixar aplicativo: leia o QR Code do caixa</li>
        {restaurant.referralPoints > 0 && (
          <li className="flex items-center gap-2.5"><Icon name="check" size={18} className="text-emerald-600" /> {friend} ganha {formatPoints(restaurant.referralPoints)} pontos quando você fizer a primeira compra</li>
        )}
      </ul>

      {customer ? (
        <>
          <p className="mb-4 text-center text-sm text-slate-600">Você já tem conta, {customer.name.split(' ')[0]}. O convite vale só para quem ainda não é cliente do Fidelize.</p>
          <Link href={`/lugar/${restaurant.id}`} className="glass-button">Ver o clube do {restaurant.name}</Link>
        </>
      ) : (
        <CustomerAuthForm invite={{ restaurantId: restaurant.id, code }} cta="Criar minha conta e entrar no clube" />
      )}
    </Shell>
  );
}
