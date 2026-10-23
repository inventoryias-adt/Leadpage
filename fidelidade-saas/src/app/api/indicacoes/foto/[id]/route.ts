import { prisma } from '@/lib/db';
import { getCustomer } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Foto de uma indicação. Só clientes logados a recebem (não é pública). Indicação escondida pela administração só
 * aparece para quem a publicou. A foto de uma indicação nunca muda, então o navegador pode guardá-la.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await getCustomer();
  if (!customer) return new Response('Não autorizado', { status: 401, headers: { 'Cache-Control': 'no-store' } });
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  const post = await prisma.post.findFirst({
    where: { id, OR: [{ hiddenAt: null }, { customerId: customer.id }] },
    select: { photo: { select: { mime: true, data: true } } },
  });
  if (!post?.photo) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return new Response(new Uint8Array(post.photo.data), {
    headers: { 'Content-Type': post.photo.mime, 'Cache-Control': 'private, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' },
  });
}
