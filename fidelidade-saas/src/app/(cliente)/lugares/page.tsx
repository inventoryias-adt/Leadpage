import { Brand } from '@/components/Brand';
import { PlacesExplorer, type PlaceCard } from '@/components/PlacesExplorer';
import { buildCampaigns } from '@/lib/campaigns';
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
        logoImageId: true,
        pointsPerReal: true,
        units: {
          where: { active: true },
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true, address: true, latitude: true, longitude: true, openingSchedule: true },
        },
        rewards: { where: { active: true }, select: { pointsCost: true }, orderBy: { pointsCost: 'asc' }, take: 1 },
        checkInPoints: true,
        referralPoints: true,
        challenges: { where: { active: true }, select: { id: true, kind: true, target: true, minAmountCents: true, period: true, bonusPoints: true }, take: 6 },
      },
      take: 300,
    }),
    customer ? prisma.wallet.findMany({ where: { customerId: customer.id }, select: { restaurantId: true, balance: true } }) : Promise.resolve([]),
  ]);

  const balances = new Map(wallets.map((w) => [w.restaurantId, w.balance]));
  const places: PlaceCard[] = restaurants
    .filter((r) => r.units.length > 0)
    .map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      categoryLabel: categoryLabel(r.category),
      logoUrl: imageUrl(r.logoImageId),
      pointsPerReal: r.pointsPerReal,
      balance: customer ? (balances.get(r.id) ?? 0) : null,
      minReward: r.rewards[0]?.pointsCost ?? null,
      challenges: r.challenges.length,
      campaigns: buildCampaigns(r.id, {
        challenges: r.challenges,
        checkInPoints: r.checkInPoints,
        hasCoords: r.units.some((u) => u.latitude != null && u.longitude != null),
        referralPoints: r.referralPoints,
      }),
      units: r.units.map((u) => {
        const schedule = parseSchedule(u.openingSchedule);
        return { id: u.id, name: u.name, address: u.address, lat: u.latitude, lng: u.longitude, openNow: schedule ? isOpenNow(schedule) : null };
      }),
    }));

  return (
    <main className="p-4 sm:p-6 md:pt-8">
      <header className="mb-5">
        <div className="md:hidden"><Brand href="/carteira" /></div>
        <h1 className="mt-5 text-2xl font-extrabold md:mt-0 md:text-3xl tracking-tight text-primary">Lugares</h1>
        <p className="text-sm text-slate-600">Encontre onde ganhar pontos e o que você pode resgatar.</p>
      </header>
      <PlacesExplorer places={places} categories={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))} loggedIn={!!customer} />
    </main>
  );
}
