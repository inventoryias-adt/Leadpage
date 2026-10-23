import 'server-only';
import { BusinessError } from './claims';
import type { ChatSender } from './chat';
import { parseMessage, preview } from './chat';
import { prisma } from './db';
import { notify } from './notifications';

export type ChatMsg = { id: string; sender: ChatSender; body: string; createdAt: string };
const MAX_THREAD = 300;

const toMsg = (m: { id: string; sender: string; body: string; createdAt: Date }): ChatMsg => ({ id: m.id, sender: m.sender as ChatSender, body: m.body, createdAt: m.createdAt.toISOString() });

/** Conversa só existe entre quem tem relação: o cliente com carteira no lugar (ativo) e o próprio lugar. */
async function assertRelated(customerId: string, restaurantId: string) {
  const wallet = await prisma.wallet.findFirst({ where: { customerId, restaurantId, restaurant: { subscriptionStatus: 'ACTIVE', onboardedAt: { not: null } } }, select: { id: true } });
  if (!wallet) throw new BusinessError('Só dá para conversar com lugares onde o cliente tem carteira.');
}

/** Abre (ou cria) a conversa do par cliente × lugar. */
export async function openConversation(customerId: string, restaurantId: string) {
  const found = await prisma.conversation.findUnique({ where: { customerId_restaurantId: { customerId, restaurantId } }, select: { id: true } });
  if (found) return found.id;
  await assertRelated(customerId, restaurantId);
  const created = await prisma.conversation.upsert({ where: { customerId_restaurantId: { customerId, restaurantId } }, update: {}, create: { customerId, restaurantId }, select: { id: true } });
  return created.id;
}

/** Confere que a conversa é de quem pede e devolve os dados básicos. */
async function ownConversation(conversationId: string, as: ChatSender, userId: string) {
  const c = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { id: true, customerId: true, restaurantId: true, customerReadAt: true, restaurant: { select: { name: true } } } });
  if (!c || (as === 'CUSTOMER' ? c.customerId !== userId : c.restaurantId !== userId)) throw new BusinessError('Conversa não encontrada.');
  return c;
}

/** Envia a mensagem. Quando o lugar responde e o cliente não tinha nada novo por ler, ele recebe um aviso. */
export async function sendMessage(conversationId: string, as: ChatSender, userId: string, raw: unknown) {
  const parsed = parseMessage(raw);
  if (!parsed.ok) throw new BusinessError(parsed.error);
  const c = await ownConversation(conversationId, as, userId);
  let notifyCustomer = false;
  if (as === 'RESTAURANT') {
    const unread = await prisma.chatMessage.count({ where: { conversationId, sender: 'RESTAURANT', ...(c.customerReadAt ? { createdAt: { gt: c.customerReadAt } } : {}) } });
    notifyCustomer = unread === 0;
  }
  const now = new Date();
  const msg = await prisma.$transaction(async (tx) => {
    const m = await tx.chatMessage.create({ data: { conversationId, sender: as, body: parsed.body, createdAt: now } });
    await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: now, ...(as === 'CUSTOMER' ? { customerReadAt: now } : { restaurantReadAt: now }) } });
    if (notifyCustomer) await notify(tx, { customerId: c.customerId, restaurantId: c.restaurantId, title: `${c.restaurant.name} respondeu`, body: preview(parsed.body, 90), href: `/mensagens/${c.restaurantId}` });
    return m;
  });
  return toMsg(msg);
}

/** Mensagens da conversa (as últimas 300), da mais antiga para a mais nova; `after` traz só as posteriores a um instante. */
export async function thread(conversationId: string, as: ChatSender, userId: string, after?: string) {
  await ownConversation(conversationId, as, userId);
  const since = after && !Number.isNaN(Date.parse(after)) ? new Date(after) : null;
  const rows = await prisma.chatMessage.findMany({
    where: { conversationId, ...(since ? { createdAt: { gt: since } } : {}) },
    orderBy: { createdAt: 'desc' },
    take: MAX_THREAD,
  });
  return rows.reverse().map(toMsg);
}

/** Marca a conversa como lida por quem está olhando (e apaga o aviso do cliente que apontava para ela). */
export async function markRead(conversationId: string, as: ChatSender, userId: string) {
  const c = await ownConversation(conversationId, as, userId);
  const last = await prisma.chatMessage.findFirst({ where: { conversationId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
  const at = new Date(Math.max(Date.now(), last?.createdAt.getTime() ?? 0));
  await prisma.conversation.update({ where: { id: conversationId }, data: as === 'CUSTOMER' ? { customerReadAt: at } : { restaurantReadAt: at } });
  if (as === 'CUSTOMER') await prisma.notification.updateMany({ where: { customerId: userId, href: `/mensagens/${c.restaurantId}`, readAt: null }, data: { readAt: at } });
}

export type ConversationRow = {
  id: string;
  lastMessageAt: Date;
  unread: boolean;
  last: { sender: ChatSender; body: string } | null;
  other: { id: string; name: string; logoImageId: string | null };
};

/** Ids das conversas com mensagem do outro lado ainda não vista. */
async function unreadIds(as: ChatSender, userId: string): Promise<Set<string>> {
  const rows = as === 'CUSTOMER'
    ? await prisma.$queryRaw<{ id: string }[]>`
        SELECT c.id FROM "Conversation" c
        WHERE c."customerId" = ${userId} AND EXISTS (SELECT 1 FROM "ChatMessage" m WHERE m."conversationId" = c.id AND m.sender = 'RESTAURANT' AND (c."customerReadAt" IS NULL OR m."createdAt" > c."customerReadAt"))`
    : await prisma.$queryRaw<{ id: string }[]>`
        SELECT c.id FROM "Conversation" c
        WHERE c."restaurantId" = ${userId} AND EXISTS (SELECT 1 FROM "ChatMessage" m WHERE m."conversationId" = c.id AND m.sender = 'CUSTOMER' AND (c."restaurantReadAt" IS NULL OR m."createdAt" > c."restaurantReadAt"))`;
  return new Set(rows.map((r) => r.id));
}

/** Quantas conversas têm algo novo (bolinha do menu). */
export async function unreadConversations(as: ChatSender, userId: string) {
  return (await unreadIds(as, userId)).size;
}

/** Conversas de quem olha, da mais recente para a mais antiga (só as que já têm mensagem). */
export async function conversations(as: ChatSender, userId: string): Promise<ConversationRow[]> {
  const [rows, unread] = await Promise.all([
    prisma.conversation.findMany({
      where: { ...(as === 'CUSTOMER' ? { customerId: userId } : { restaurantId: userId }), messages: { some: {} } },
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
      select: {
        id: true, lastMessageAt: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { sender: true, body: true } },
        customer: { select: { id: true, name: true } },
        restaurant: { select: { id: true, name: true, logoImageId: true } },
      },
    }),
    unreadIds(as, userId),
  ]);
  return rows.map((r) => ({
    id: r.id,
    lastMessageAt: r.lastMessageAt,
    unread: unread.has(r.id),
    last: r.messages[0] ? { sender: r.messages[0].sender as ChatSender, body: r.messages[0].body } : null,
    other: as === 'CUSTOMER' ? r.restaurant : { id: r.customer.id, name: r.customer.name, logoImageId: null },
  }));
}
