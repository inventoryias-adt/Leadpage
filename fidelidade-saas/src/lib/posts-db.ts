import 'server-only';
import { BusinessError } from './claims';
import { prisma } from './db';
import { parseImageDataUrl } from './images';
import { POSTS_PER_DAY, REPORT_REASON_MAX, parsePost, postPhotoPath } from './posts';
import { cleanText } from './reviews';

export const postPhotoUrl = postPhotoPath;
const DAY = 24 * 3600e3;

/** Lugares sobre os quais o cliente pode indicar: os ativos onde ele tem carteira. */
export async function eligiblePlaces(customerId: string) {
  const wallets = await prisma.wallet.findMany({
    where: { customerId, restaurant: { subscriptionStatus: 'ACTIVE', onboardedAt: { not: null } } },
    select: { restaurant: { select: { id: true, name: true, logoImageId: true } } },
    orderBy: { balance: 'desc' },
  });
  return wallets.map((w) => w.restaurant);
}

/** Publica a indicação: confere o lugar (só quem tem carteira), o limite diário e a foto. */
export async function createPost(customerId: string, raw: { restaurantId?: unknown; rating?: unknown; comment?: unknown }, photoDataUrl: string) {
  if (!photoDataUrl) throw new BusinessError('Escolha a foto da indicação.');
  const parsed = parsePost(raw);
  if (!parsed.ok) throw new BusinessError(parsed.error);
  const { restaurantId, rating, comment } = parsed.value;
  const { mime, data } = parseImageDataUrl(photoDataUrl);
  const wallet = await prisma.wallet.findFirst({ where: { customerId, restaurantId, restaurant: { subscriptionStatus: 'ACTIVE', onboardedAt: { not: null } } }, select: { id: true } });
  if (!wallet) throw new BusinessError('Você só pode indicar lugares onde já tem carteira.');
  const recent = await prisma.post.count({ where: { customerId, createdAt: { gt: new Date(Date.now() - DAY) } } });
  if (recent >= POSTS_PER_DAY) throw new BusinessError(`Você já fez ${POSTS_PER_DAY} indicações hoje. Volte amanhã.`);
  return prisma.post.create({ data: { customerId, restaurantId, rating, comment, photo: { create: { mime, data } } }, select: { id: true } });
}

export type FeedPost = {
  id: string;
  photoUrl: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  likes: number;
  liked: boolean;
  mine: boolean;
  hidden: boolean;
  author: { name: string; instagram: string | null };
  place: { id: string; name: string; logoImageId: string | null; instagram: string | null };
};

/** Feed de indicações, da mais nova para a mais antiga. Esconde as ocultadas (o autor ainda vê as dele, marcadas). */
export async function feed(viewerId: string, opts: { restaurantId?: string; mine?: boolean; before?: Date; take?: number } = {}) {
  const take = Math.min(opts.take ?? 12, 40);
  const rows = await prisma.post.findMany({
    where: {
      ...(opts.mine ? { customerId: viewerId } : opts.restaurantId ? { restaurantId: opts.restaurantId } : {}),
      ...(opts.before ? { createdAt: { lt: opts.before } } : {}),
      OR: [{ hiddenAt: null }, { customerId: viewerId }],
      restaurant: { subscriptionStatus: 'ACTIVE' },
    },
    orderBy: { createdAt: 'desc' },
    take: take + 1,
    select: {
      id: true, rating: true, comment: true, createdAt: true, hiddenAt: true, customerId: true,
      customer: { select: { name: true, instagram: true } },
      restaurant: { select: { id: true, name: true, logoImageId: true, instagram: true } },
      _count: { select: { likes: true } },
      likes: { where: { customerId: viewerId }, select: { customerId: true } },
    },
  });
  const page = rows.slice(0, take);
  const posts: FeedPost[] = page.map((p) => ({
    id: p.id,
    photoUrl: postPhotoUrl(p.id),
    rating: p.rating,
    comment: p.comment,
    createdAt: p.createdAt,
    likes: p._count.likes,
    liked: p.likes.length > 0,
    mine: p.customerId === viewerId,
    hidden: p.hiddenAt != null,
    author: { name: p.customer.name, instagram: p.customer.instagram },
    place: { id: p.restaurant.id, name: p.restaurant.name, logoImageId: p.restaurant.logoImageId, instagram: p.restaurant.instagram },
  }));
  return { posts, nextBefore: rows.length > take ? page[page.length - 1].createdAt : null };
}

/** Curtir/descurtir. Devolve o estado novo e o total. */
export async function toggleLike(customerId: string, postId: string) {
  const post = await prisma.post.findFirst({ where: { id: postId, hiddenAt: null, restaurant: { subscriptionStatus: 'ACTIVE' } }, select: { id: true } });
  if (!post) throw new BusinessError('Esta indicação não está mais disponível.');
  const key = { postId_customerId: { postId, customerId } };
  const existing = await prisma.postLike.findUnique({ where: key });
  if (existing) await prisma.postLike.delete({ where: key });
  else await prisma.postLike.create({ data: { postId, customerId } }).catch(() => undefined);
  const likes = await prisma.postLike.count({ where: { postId } });
  return { liked: !existing, likes };
}

/** O cliente denuncia uma indicação de outra pessoa. A administração decide se esconde. */
export async function reportPost(customerId: string, postId: string, reasonRaw: unknown) {
  const reason = cleanText(reasonRaw, REPORT_REASON_MAX);
  if (!reason) throw new BusinessError('Conte o motivo da denúncia.');
  const post = await prisma.post.findFirst({ where: { id: postId, customerId: { not: customerId } }, select: { id: true } });
  if (!post) throw new BusinessError('Não foi possível denunciar esta indicação.');
  const dup = await prisma.postReport.findFirst({ where: { postId, reporterCustomerId: customerId }, select: { id: true } });
  if (dup) return;
  await prisma.$transaction([
    prisma.postReport.create({ data: { postId, reporterCustomerId: customerId, reason } }),
    prisma.post.update({ where: { id: postId }, data: { reportedAt: new Date() } }),
  ]);
}

/** O autor apaga a própria indicação (a foto vai junto). */
export const deletePost = (customerId: string, postId: string) => prisma.post.deleteMany({ where: { id: postId, customerId } });

/** O dono do lugar denuncia uma indicação que cita o lugar dele. */
export async function reportPostAsOwner(restaurantId: string, postId: string, reasonRaw: unknown) {
  const reason = cleanText(reasonRaw, REPORT_REASON_MAX);
  if (!reason) throw new BusinessError('Conte o motivo da denúncia.');
  const post = await prisma.post.findFirst({ where: { id: postId, restaurantId, hiddenAt: null }, select: { id: true } });
  if (!post) throw new BusinessError('Indicação não encontrada.');
  const dup = await prisma.postReport.findFirst({ where: { postId, reporterRestaurantId: restaurantId }, select: { id: true } });
  if (dup) return;
  await prisma.$transaction([
    prisma.postReport.create({ data: { postId, reporterRestaurantId: restaurantId, reason } }),
    prisma.post.update({ where: { id: postId }, data: { reportedAt: new Date() } }),
  ]);
}

/** Administração: esconde a indicação denunciada ou a mantém (encerra as denúncias). */
export async function moderatePost(postId: string, action: 'hide' | 'keep') {
  const done = await prisma.post.updateMany({
    where: { id: postId, reportedAt: { not: null } },
    data: action === 'hide' ? { hiddenAt: new Date() } : { reportedAt: null },
  });
  if (done.count !== 1) throw new BusinessError('Indicação não encontrada ou sem denúncia.');
  if (action === 'keep') await prisma.postReport.deleteMany({ where: { postId } });
}
