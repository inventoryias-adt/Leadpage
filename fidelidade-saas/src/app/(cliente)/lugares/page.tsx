import type { SavedAddress } from '@/app/actions/location';
import { Brand } from '@/components/Brand';
import { Reveal } from '@/components/Reveal';
import { PlacesExplorer, type PlaceCard, type PlaceOffer } from '@/components/PlacesExplorer';
import { buildCampaigns } from '@/lib/campaigns';
import { cashbackPct } from '@/lib/points-discount';
import { offerEndText, promoActive } from '@/lib/orders';
import { CATEGORIES, CATEGORY_HINT, categoryLabel } from '@/lib/categories';
import { savedText } from '@/lib/customer-location';
import { prisma } from '@/lib/db';
import { isOpenNow, parseSchedule } from '@/lib/hours';
import { imageUrl } from '@/lib/images';
import { placeSummaries } from '@/lib/reviews-db';
import { getCustomer } from '@/lib/session';

export const metadata = { title: 'Lugares' };
export const dynamic = 'force-dynamic';

export default async function LugaresPage() {
  const customer = await getCustomer();

  const [restaurants, wallets, addresses] = await Promise.all([
    prisma.restaurant.findMany({
      where: { subscriptionStatus: 'ACTIVE', onboardedAt: { not: null }, listed: true },
      select: {
        id: true,
        name: true,
        category: true, categoryOther: true,
        logoImageId: true,
        pointsPerReal: true,
        pointsPerRealOff: true,
        instagram: true,
        ordersEnabled: true,
        menuItems: { where: { active: true, promoCents: { not: null } }, orderBy: [{ spotlight: 'desc' }, { createdAt: 'desc' }], take: 8 }, // com promoção; a oferta em destaque (spotlight) vem primeiro
        units: {
          where: { active: true },
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true, address: true, latitude: true, longitude: true, openingSchedule: true, googleReviewUrl: true },
        },
        rewards: { where: { active: true }, select: { pointsCost: true }, orderBy: { pointsCost: 'asc' }, take: 1 },
        checkInPoints: true,
        referralPoints: true,
        promotions: { where: { active: true, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] } },
        challenges: { where: { active: true }, select: { id: true, kind: true, target: true, minAmountCents: true, period: true, bonusPoints: true }, take: 6 },
      },
      take: 300,
    }),
    customer ? prisma.wallet.findMany({ where: { customerId: customer.id }, select: { restaurantId: true, balance: true } }) : Promise.resolve([]),
    customer ? prisma.customerAddress.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: 'desc' } }) : Promise.resolve([]),
  ]);
  const savedAddresses: SavedAddress[] = addresses.map((a) => ({ id: a.id, label: a.label, ...savedText(a), lat: a.latitude, lng: a.longitude }));

  const balances = new Map(wallets.map((w) => [w.restaurantId, w.balance]));
  const now = new Date();
  const toOffer = (m: (typeof restaurants)[number]['menuItems'][number]): PlaceOffer => ({
    itemId: m.id,
    name: m.name,
    priceCents: m.priceCents,
    promoCents: m.promoCents as number,
    imageUrl: imageUrl(m.imageId),
    endsText: m.offerEndsAt ? offerEndText(m.offerEndsAt) : null,
    stock: m.offerStock,
    stockTotal: m.offerStockTotal,
  });
  const ratings = await placeSummaries(restaurants.map((r) => r.id));
  const places: PlaceCard[] = restaurants
    .filter((r) => r.units.length > 0)
    .map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      categoryLabel: categoryLabel(r.category, r.categoryOther),
      logoUrl: imageUrl(r.logoImageId),
      pointsPerReal: r.pointsPerReal,
      cashbackPct: cashbackPct(r.pointsPerReal, r.pointsPerRealOff) || null,
      hasGoogle: r.units.some((u) => !!u.googleReviewUrl),
      hasInstagram: !!r.instagram,
      hasRewards: r.rewards.length > 0,
      // Cartão grande na lista: a oferta em destaque que ainda vale. "Promoções de hoje": todo item com promoção que ainda vale.
      offer: (() => {
        const m = r.ordersEnabled ? r.menuItems.find((i) => i.spotlight && promoActive(i, now)) : undefined;
        return m ? toOffer(m) : null;
      })(),
      deals: r.ordersEnabled ? r.menuItems.filter((i) => promoActive(i, now)).map(toOffer) : [],
      balance: customer ? (balances.get(r.id) ?? 0) : null,
      minReward: r.rewards[0]?.pointsCost ?? null,
      challenges: r.challenges.length,
      rating: ratings.get(r.id) ?? null,
      campaigns: buildCampaigns(r.id, {
        challenges: r.challenges,
        checkInPoints: r.checkInPoints,
        hasCoords: r.units.some((u) => u.latitude != null && u.longitude != null),
        referralPoints: r.referralPoints,
        promotions: r.promotions,
      }),
      units: r.units.map((u) => {
        const schedule = parseSchedule(u.openingSchedule);
        return { id: u.id, name: u.name, address: u.address, lat: u.latitude, lng: u.longitude, openNow: schedule ? isOpenNow(schedule) : null };
      }),
    }));

  return (
    <main className="p-4 sm:p-6 md:pt-8">
      <Reveal as="header" from="top" className="mb-5">
        <div className="md:hidden"><Brand href="/carteira" /></div>
        <h1 className="mt-5 text-2xl font-extrabold md:mt-0 md:text-3xl tracking-tight text-primary">Lugares</h1>
      </Reveal>
      <PlacesExplorer places={places} categories={CATEGORIES.map((c) => ({ value: c.value, label: c.label, hint: CATEGORY_HINT[c.value] }))} loggedIn={!!customer} savedAddresses={savedAddresses} />
    </main>
  );
}
