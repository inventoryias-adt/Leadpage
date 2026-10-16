import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Illustration } from '@/components/Illustrations';
import { OrderMenu, type MenuGroup, type MenuView } from '@/components/OrderMenu';
import { prisma } from '@/lib/db';
import { isOpenNow, parseSchedule } from '@/lib/hours';
import { imageUrl } from '@/lib/images';
import { promoActive } from '@/lib/orders';
import { getCustomer } from '@/lib/session';

export const metadata = { title: 'Fazer pedido' };
export const dynamic = 'force-dynamic';

export default async function PedidoPage({ params, searchParams }: { params: Promise<{ restaurantId: string }>; searchParams: Promise<{ unidade?: string; item?: string }> }) {
  const { restaurantId } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(restaurantId)) notFound();
  const customer = await getCustomer();

  const [restaurant, items, units] = await Promise.all([
    prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, name: true, subscriptionStatus: true, onboardedAt: true, ordersEnabled: true, orderPrepMin: true, pointsPerReal: true, logoImageId: true },
    }),
    prisma.menuItem.findMany({ where: { restaurantId, active: true }, orderBy: [{ category: 'asc' }, { createdAt: 'asc' }] }),
    prisma.unit.findMany({ where: { restaurantId, active: true }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, address: true, openingSchedule: true } }),
  ]);
  if (!restaurant || restaurant.subscriptionStatus !== 'ACTIVE' || !restaurant.onboardedAt) notFound();

  const back = `/lugar/${restaurantId}`;
  if (!restaurant.ordersEnabled || items.length === 0 || units.length === 0) {
    return (
      <main className="p-4 sm:p-6 md:pt-8">
        <div className="glass-panel mx-auto max-w-xl p-6 text-center">
          <Illustration variant="empty" size={150} />
          <p className="font-bold text-slate-800">{restaurant.name} não está recebendo pedidos pelo app agora</p>
          <p className="mb-4 mt-1 text-sm text-slate-600">Você ainda pode ganhar pontos no balcão e trocar por prêmios.</p>
          <Link href={back} className="glass-button">Voltar ao lugar</Link>
        </div>
      </main>
    );
  }

  const unit = units.find((u) => u.id === sp.unidade) ?? units[0];
  const schedule = parseSchedule(unit.openingSchedule);
  const now = new Date();
  // A promoção já vem resolvida: fora do prazo ou sem estoque, o cliente vê (e paga) o preço normal. O servidor confere de novo ao confirmar.
  const view = (i: (typeof items)[number]): MenuView => {
    const live = promoActive(i, now);
    return { id: i.id, name: i.name, description: i.description, priceCents: i.priceCents, promoCents: live ? i.promoCents : null, imageUrl: imageUrl(i.imageId), stock: live ? i.offerStock : null };
  };
  const featured = items.find((i) => i.featured) ?? null;
  const groups: MenuGroup[] = [];
  for (const i of items) {
    if (i.id === featured?.id) continue; // o destaque já aparece em cima
    const g = groups.find((x) => x.name === i.category);
    if (g) g.items.push(view(i));
    else groups.push({ name: i.category, items: [view(i)] });
  }

  return (
    <main>
      <OrderMenu
        restaurantId={restaurantId}
        placeName={restaurant.name}
        logoUrl={imageUrl(restaurant.logoImageId)}
        open={schedule ? isOpenNow(schedule) : null}
        prepMin={restaurant.orderPrepMin}
        units={units.map((u) => ({ id: u.id, name: u.name, address: u.address }))}
        initialUnitId={unit.id}
        loggedIn={!!customer}
        pointsPerReal={restaurant.pointsPerReal}
        featured={featured ? view(featured) : null}
        groups={groups}
        backHref={back}
        preselectId={items.some((i) => i.id === sp.item) ? sp.item : undefined}
      />
    </main>
  );
}
