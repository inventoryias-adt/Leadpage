import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Icon } from '@/components/Icons';
import { Illustration } from '@/components/Illustrations';
import { RewardBag } from '@/components/RewardBag';
import { prisma } from '@/lib/db';
import { parseSchedule, summarizeSchedule } from '@/lib/hours';
import { imageUrl } from '@/lib/images';
import { startOfMonthBR } from '@/lib/points';
import { getCustomer } from '@/lib/session';

export const metadata = { title: 'Prêmios' };
export const dynamic = 'force-dynamic';

export default async function PremiosPage({ params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(restaurantId)) notFound();
  const customer = await getCustomer();

  const ofWallet = customer ? { customerId: customer.id, restaurantId } : null;
  const [restaurant, rewards, wallet, usedThisMonth] = await Promise.all([
    prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, name: true, subscriptionStatus: true, onboardedAt: true, maxRedeemsPerMonth: true, openingSchedule: true },
    }),
    prisma.reward.findMany({ where: { restaurantId, active: true }, orderBy: { pointsCost: 'asc' } }),
    ofWallet ? prisma.wallet.findUnique({ where: { customerId_restaurantId: ofWallet } }) : null,
    ofWallet ? prisma.redemption.count({ where: { ...ofWallet, createdAt: { gte: startOfMonthBR() } } }) : 0,
  ]);
  if (!restaurant || restaurant.subscriptionStatus !== 'ACTIVE' || !restaurant.onboardedAt) notFound();

  const schedule = parseSchedule(restaurant.openingSchedule);
  const hoursText = schedule ? summarizeSchedule(schedule).map((g) => `${g.label} ${g.hours}`).join(' · ') : null;
  const back = (
    <Link href={`/lugar/${restaurantId}`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-electric-600 hover:text-primary">
      <Icon name="back" size={16} /> {restaurant.name}
    </Link>
  );

  return (
    <main className="p-4 sm:p-6">
      {back}
      <h1 className="text-2xl font-extrabold tracking-tight text-primary">Troque seus pontos</h1>
      <p className="mb-5 text-sm text-slate-600">Escolha os prêmios, monte a sua sacola e retire no balcão.</p>

      {!customer ? (
        <div className="glass-panel p-6 text-center">
          <Illustration variant="gift" size={160} />
          <p className="font-bold text-slate-800">Entre para resgatar seus prêmios</p>
          <p className="mb-4 mt-1 text-sm text-slate-600">Use CPF e telefone. Seus pontos de cada lugar ficam guardados na sua carteira.</p>
          <Link href={`/entrar?next=${encodeURIComponent(`/lugar/${restaurantId}/premios`)}`} className="glass-button">Entrar</Link>
        </div>
      ) : rewards.length === 0 ? (
        <div className="glass-panel p-6 text-center">
          <Illustration variant="empty" size={150} />
          <p className="font-bold text-slate-800">Nenhum prêmio por aqui ainda</p>
          <p className="mt-1 text-sm text-slate-600">O restaurante ainda não cadastrou prêmios. Volte em breve!</p>
        </div>
      ) : (
        <RewardBag
          restaurantId={restaurantId}
          balance={wallet?.balance ?? 0}
          remainingThisMonth={Math.max(0, restaurant.maxRedeemsPerMonth - usedThisMonth)}
          limit={restaurant.maxRedeemsPerMonth}
          hoursText={hoursText}
          rewards={rewards.map((r) => ({ id: r.id, name: r.name, description: r.description, pointsCost: r.pointsCost, imageUrl: imageUrl(r.imageId) }))}
        />
      )}
    </main>
  );
}
