import { Brand } from '@/components/Brand';
import { PlacesExplorer, type PlaceCard } from '@/components/PlacesExplorer';
import { CATEGORIES, categoryLabel } from '@/lib/categories';
import { prisma } from '@/lib/db';
import { isOpenNow, parseSchedule } from '@/lib/hours';
import { imageUrl } from '@/lib/images';
import { getCustomer } from '@/lib/session';

export const metadata = { title: 'Lugares' };
export const dynamic = 'force-dynamic';

export default async function LugaresPage() {
  const customer = await getCustomer();

  const [restaurants, wallets] = await Promise.all([
    prisma.restaurant.findMany({
      where: { subscriptionStatus: 'ACTIVE', onboardedAt: { not: null }, listed: true },
      select: {
        id: true,
        name: true,
        category: true,
        address: true,
        latitude: true,
        longitude: true,
        logoImageId: true,
        pointsPerReal: true,
        openingSchedule: true,
        rewards: { where: { active: true }, select: { pointsCost: true }, orderBy: { pointsCost: 'asc' }, take: 1 },
        _count: { select: { challenges: { where: { active: true } } } },
      },
      take: 300,
    }),
    customer ? prisma.wallet.findMany({ where: { customerId: customer.id }, select: { restaurantId: true, balance: true } }) : Promise.resolve([]),
  ]);

  const balances = new Map(wallets.map((w) => [w.restaurantId, w.balance]));
  const places: PlaceCard[] = restaurants.map((r) => {
    const schedule = parseSchedule(r.openingSchedule);
    return {
      id: r.id,
      name: r.name,
      category: r.category,
      categoryLabel: categoryLabel(r.category),
      address: r.address,
      lat: r.latitude,
      lng: r.longitude,
      logoUrl: imageUrl(r.logoImageId),
      pointsPerReal: r.pointsPerReal,
      openNow: schedule ? isOpenNow(schedule) : null,
      balance: customer ? (balances.get(r.id) ?? 0) : null,
      minReward: r.rewards[0]?.pointsCost ?? null,
      challenges: r._count.challenges,
    };
  });

  return (
    <main className="p-4 sm:p-6">
      <header className="mb-5">
        <Brand href="/carteira" />
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-primary">Lugares</h1>
        <p className="text-sm text-slate-600">Encontre onde ganhar pontos e o que você pode resgatar.</p>
      </header>
      <PlacesExplorer places={places} categories={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))} loggedIn={!!customer} />
    </main>
  );
}
