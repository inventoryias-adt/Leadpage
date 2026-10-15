import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { BusinessError, creditClaimWith } from './claims';
import { MAX_BILL_CENTS, formatBRL } from './points';
import { MAX_ITEMS_PER_ORDER, MAX_NOTE, MAX_OPEN_ORDERS, OPEN_STATUSES, STATUS_LABEL, canMove, cartCount, cleanCart, orderPoints, orderTotal, prepText, promoActive, unitPrice, type OrderStatus } from './orders';
import { sendEmail } from './mailer';
import { notify } from './notifications';
import { appUrl } from './payments';
import { newClaimToken, newVoucherCode } from './tokens';

/**
 * Faz o pedido. O preço, o total e o tempo de preparo são sempre os do servidor: do navegador só vem "quais itens e quantos".
 * O pagamento acontece no balcão; os pontos só entram quando o lugar marca como retirado.
 */
export async function placeOrder(customerId: string, restaurantId: string, rawItems: unknown, opts: { unitId?: string; note?: string } = {}) {
  const cart = cleanCart(rawItems);
  const count = cartCount(cart);
  if (count === 0) throw new BusinessError('Sua sacola está vazia.');
  if (count > MAX_ITEMS_PER_ORDER) throw new BusinessError(`Faça pedidos de até ${MAX_ITEMS_PER_ORDER} itens por vez.`);
  const note = (opts.note ?? '').trim().slice(0, MAX_NOTE) || null;

  const order = await prisma.$transaction(
    async (tx) => {
      const restaurant = await tx.restaurant.findUnique({
        where: { id: restaurantId },
        select: { subscriptionStatus: true, onboardedAt: true, ordersEnabled: true, orderPrepMin: true },
      });
      if (!restaurant || restaurant.subscriptionStatus !== 'ACTIVE' || !restaurant.onboardedAt || !restaurant.ordersEnabled) {
        throw new BusinessError('Este lugar não está recebendo pedidos pelo app agora.');
      }

      const items = await tx.menuItem.findMany({ where: { id: { in: cart.map((c) => c.menuItemId) }, restaurantId, active: true } });
      if (items.length !== cart.length) throw new BusinessError('Algum item da sacola não está mais disponível. Atualize a página.');

      const units = await tx.unit.findMany({ where: { restaurantId, active: true }, orderBy: { createdAt: 'asc' }, select: { id: true } });
      const unit = opts.unitId ? units.find((u) => u.id === opts.unitId) : units[0];
      if (!unit) throw new BusinessError('Escolha onde vai retirar.');

      const open = await tx.order.count({ where: { customerId, restaurantId, status: { in: OPEN_STATUSES } } });
      if (open >= MAX_OPEN_ORDERS) throw new BusinessError('Você já tem pedidos em andamento neste lugar. Aguarde a retirada ou cancele um deles.');

      const byId = new Map(items.map((i) => [i.id, i]));
      const lines = cart.map((c) => ({ item: byId.get(c.menuItemId)!, qty: c.qty }));
      const now = new Date();
      const totalCents = orderTotal(lines, now);
      if (totalCents <= 0) throw new BusinessError('Este pedido não tem valor. Atualize a página.');
      if (totalCents > MAX_BILL_CENTS) throw new BusinessError('Valor do pedido acima do limite.');

      // Oferta com estoque: reserva as unidades na hora (condição no próprio UPDATE: dois pedidos ao mesmo tempo não passam do estoque).
      for (const { item, qty } of lines) {
        if (item.offerStock == null || !promoActive(item, now)) continue;
        const taken = await tx.menuItem.updateMany({ where: { id: item.id, offerStock: { gte: qty } }, data: { offerStock: { decrement: qty } } });
        if (taken.count !== 1) {
          const left = Math.max(0, (await tx.menuItem.findUnique({ where: { id: item.id }, select: { offerStock: true } }))?.offerStock ?? 0);
          throw new BusinessError(left > 0 ? `Na oferta de ${item.name} restam só ${left}. Ajuste a quantidade.` : `A oferta de ${item.name} acabou. Atualize a página.`);
        }
      }

      // O código aparece no balcão; é único por lugar. Repete se der colisão (raríssimo).
      for (let attempt = 0; attempt < 6; attempt++) {
        try {
          return await tx.order.create({
            data: {
              restaurantId,
              unitId: unit.id,
              customerId,
              code: newVoucherCode(),
              totalCents,
              prepMin: restaurant.orderPrepMin,
              note,
              items: {
                create: lines.map(({ item, qty }) => ({ menuItemId: item.id, name: item.name, unitCents: unitPrice(item, now), listCents: item.priceCents, qty, imageId: item.imageId })),
              },
            },
            include: { items: true },
          });
        } catch (e) {
          if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
        }
      }
      throw new BusinessError('Não foi possível gerar o código do pedido. Tente de novo.');
    },
    { timeout: 15_000 },
  );

  void notifyOwner(order.id).catch(() => {}); // aviso é só um extra: o pedido já está feito
  return order;
}

/** E-mail ao estabelecimento a cada novo pedido (o painel também atualiza sozinho). */
export async function notifyOwner(orderId: string) {
  const o = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      customer: { select: { name: true } },
      unit: { select: { name: true } },
      restaurant: { select: { name: true, email: true, bookingNotifyEmail: true } },
    },
  });
  if (!o) return;
  const to = o.restaurant.bookingNotifyEmail || o.restaurant.email;
  const lines = [
    `Novo pedido para retirada em ${o.restaurant.name}:`,
    '',
    `Código: ${o.code}`,
    `Cliente: ${o.customer.name}`,
    o.unit ? `Retirada em: ${o.unit.name} (${prepText(o.prepMin)})` : null,
    '',
    ...o.items.map((i) => `${i.qty}× ${i.name} — ${formatBRL(i.unitCents * i.qty)}`),
    '',
    `Total a cobrar no balcão: ${formatBRL(o.totalCents)}`,
    o.note ? `Observação do cliente: ${o.note}` : null,
    '',
    `Veja e atualize o pedido: ${appUrl()}/dashboard/pedidos`,
  ].filter((l) => l !== null) as string[];
  await sendEmail({ to, subject: `Novo pedido ${o.code} · ${formatBRL(o.totalCents)}`, text: lines.join('\n') });
}

/**
 * O lugar muda o status do pedido. "Retirado" fecha o pedido e credita os pontos do que foi pago, tudo na mesma transação
 * (reaproveita o crédito do caixa: campanhas, indicação e desafios valem do mesmo jeito). "Pronto" e "Cancelado" avisam o cliente.
 */
export async function setOrderStatus(id: string, restaurantId: string, to: OrderStatus) {
  if (to === 'CANCELED') return cancelOrder(id, 'OWNER', { restaurantId });

  const done = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({ where: { id, restaurantId } });
    if (!order) throw new BusinessError('Pedido não encontrado.');
    if (!canMove(order.status, to)) throw new BusinessError(`Este pedido já está como "${STATUS_LABEL[order.status].toLowerCase()}".`);

    // Condição no status de origem: dois cliques simultâneos mudam o pedido uma só vez (e os pontos entram uma só vez).
    const now = new Date();
    const marked = await tx.order.updateMany({
      where: { id, status: order.status },
      data: { status: to, ...(to === 'READY' ? { readyAt: now } : {}), ...(to === 'PICKED_UP' ? { pickedUpAt: now, readyAt: order.readyAt ?? now } : {}) },
    });
    if (marked.count !== 1) throw new BusinessError('Este pedido acabou de ser atualizado. Recarregue a página.');

    let pointsAwarded = 0;
    if (to === 'PICKED_UP') {
      const restaurant = await tx.restaurant.findUnique({ where: { id: restaurantId }, select: { pointsPerReal: true } });
      const points = orderPoints(order.totalCents, restaurant?.pointsPerReal ?? 0);
      if (points > 0) {
        const token = newClaimToken();
        const claim = await tx.claim.create({
          data: {
            token,
            restaurantId,
            unitId: order.unitId,
            amountCents: order.totalCents,
            points,
            billPoints: points,
            description: `Pedido ${order.code} (${formatBRL(order.totalCents)})`,
            expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
          },
        });
        const credited = await creditClaimWith(tx, token, order.customerId);
        pointsAwarded = credited.points;
        await tx.order.update({ where: { id }, data: { claimId: claim.id, pointsAwarded } });
      }
    }

    if (to === 'READY') {
      const place = await tx.restaurant.findUnique({ where: { id: restaurantId }, select: { name: true } });
      await notify(tx, {
        customerId: order.customerId,
        restaurantId,
        title: 'Seu pedido está pronto!',
        body: `Pedido ${order.code} · ${place?.name ?? ''}. Mostre o código no balcão para retirar.`,
        href: '/perfil/pedidos',
      });
    }
    return { pointsAwarded };
  });
  return done;
}

/** Cancela um pedido em aberto. O cliente só cancela enquanto o lugar ainda não começou a preparar. */
export async function cancelOrder(id: string, by: 'CUSTOMER' | 'OWNER', where: { customerId?: string; restaurantId?: string }) {
  return prisma.$transaction(async (tx) => {
    const allowed: OrderStatus[] = by === 'CUSTOMER' ? ['RECEIVED'] : OPEN_STATUSES;
    const order = await tx.order.findFirst({ where: { id, ...where }, include: { restaurant: { select: { name: true } } } });
    if (!order) throw new BusinessError('Pedido não encontrado.');
    if (!allowed.includes(order.status)) {
      throw new BusinessError(by === 'CUSTOMER' && OPEN_STATUSES.includes(order.status) ? 'O lugar já começou a preparar. Fale com eles no balcão para cancelar.' : 'Este pedido já foi encerrado.');
    }
    const marked = await tx.order.updateMany({ where: { id, status: order.status }, data: { status: 'CANCELED', canceledAt: new Date(), canceledBy: by } });
    if (marked.count !== 1) throw new BusinessError('Este pedido acabou de ser atualizado. Recarregue a página.');
    // Unidades vendidas pelo preço da oferta voltam ao estoque (sem passar do total da oferta).
    const sold = await tx.orderItem.findMany({ where: { orderId: id, menuItemId: { not: null } }, select: { menuItemId: true, qty: true, unitCents: true, listCents: true } });
    for (const it of sold.filter((x) => x.unitCents < x.listCents)) {
      const m = await tx.menuItem.findUnique({ where: { id: it.menuItemId as string }, select: { offerStock: true, offerStockTotal: true } });
      if (m?.offerStock == null) continue;
      await tx.menuItem.update({ where: { id: it.menuItemId as string }, data: { offerStock: Math.min(m.offerStockTotal ?? m.offerStock + it.qty, m.offerStock + it.qty) } });
    }
    if (by === 'OWNER') {
      await notify(tx, {
        customerId: order.customerId,
        restaurantId: order.restaurantId,
        title: 'Pedido cancelado pelo lugar',
        body: `Pedido ${order.code} · ${order.restaurant.name}. Fale com o lugar se precisar de ajuda.`,
        href: '/perfil/pedidos',
      });
    }
    return order;
  });
}
