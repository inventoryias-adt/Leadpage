import { prisma } from '@/lib/db';
import { getAdmin, getCustomer, getRestaurant } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'no-store' };

/**
 * Foto de uma indicação. Não é pública: recebem clientes logados, a administração (para moderar) e o dono do lugar citado.
 * Indicação escondida pela administração só aparece para quem a publicou e para a administração. A foto de uma indicação nunca
 * muda, então o navegador pode guardá-la.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response('Not found', { status: 404, headers });
  const [customer, admin, owner] = await Promise.all([getCustomer(), getAdmin(), getRestaurant()]);
  if (!customer && !admin && !owner) return new Response('Não autorizado', { status: 401, headers });
  const post = await prisma.post.findUnique({ where: { id }, select: { customerId: true, restaurantId: true, hiddenAt: true, photo: { select: { mime: true, data: true } } } });
  if (!post?.photo) return new Response('Not found', { status: 404, headers });
  const allowed = !!admin || (post.hiddenAt == null && (!!customer || owner?.id === post.restaurantId)) || (customer != null && customer.id === post.customerId);
  if (!allowed) return new Response('Not found', { status: 404, headers });
  return new Response(new Uint8Array(post.photo.data), {
    headers: { 'Content-Type': post.photo.mime, 'Cache-Control': 'private, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' },
  });
}
