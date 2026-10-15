import { prisma } from '@/lib/db';
import { getCustomer } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Foto de perfil do cliente. É um dado pessoal: só o próprio cliente logado a recebe (nunca é pública, ao contrário
 * das fotos de lugares). O endereço leva `?v=` com a hora da troca, então o navegador pode guardar a resposta.
 */
export async function GET() {
  const customer = await getCustomer();
  if (!customer) return new Response('Não autorizado', { status: 401, headers: { 'Cache-Control': 'no-store' } });
  const photo = await prisma.customerPhoto.findUnique({ where: { customerId: customer.id }, select: { mime: true, data: true } });
  if (!photo) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return new Response(new Uint8Array(photo.data), {
    headers: {
      'Content-Type': photo.mime,
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
