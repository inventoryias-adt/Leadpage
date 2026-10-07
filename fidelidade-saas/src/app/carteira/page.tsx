import Link from 'next/link';
import { redirect } from 'next/navigation';
import { customerLogout } from '@/app/actions/customer';
import { prisma } from '@/lib/db';
import { formatPoints } from '@/lib/points';
import { requireCustomer } from '@/lib/session';

export const metadata = { title: 'Minha carteira' };
export const dynamic = 'force-dynamic';

export default async function CarteiraPage() {
  const customer = await requireCustomer('/carteira');
  const wallets = await prisma.wallet.findMany({
    where: { customerId: customer.id },
    include: { restaurant: { select: { name: true, address: true } } },
    orderBy: { balance: 'desc' },
  });
  if (wallets.length === 1) redirect(`/carteira/${wallets[0].restaurantId}`);

  return (
    <main className="safe-bottom mx-auto min-h-screen max-w-md p-4 sm:p-6">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary">Olá, {customer.name.split(' ')[0]} 👋</h1>
        <form action={customerLogout}><button className="glass-button-ghost btn-sm">Sair</button></form>
      </header>

      {wallets.length === 0 ? (
        <div className="glass-panel p-6 text-center">
          <p className="font-semibold text-primary">Você ainda não tem pontos</p>
          <p className="mt-1 text-sm text-slate-600">Peça o QR Code no balcão do restaurante depois de pagar a conta.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {wallets.map((w) => (
            <Link key={w.id} href={`/carteira/${w.restaurantId}`} className="glass-panel card-link flex items-center justify-between p-5">
              <div className="min-w-0">
                <p className="truncate font-bold text-slate-800">{w.restaurant.name}</p>
                <p className="truncate text-xs text-slate-500">{w.restaurant.address}</p>
              </div>
              <p className="shrink-0 text-2xl font-extrabold text-primary">{formatPoints(w.balance)}<span className="ml-1 text-sm text-electric-600">pts</span></p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
