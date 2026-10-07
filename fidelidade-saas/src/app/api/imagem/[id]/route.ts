import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

/** Serve fotos de lugares e prêmios. O id é aleatório (UUID) e a foto muda de id quando é trocada, então o cache é imutável. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response('Not found', { status: 404 });
  const image = await prisma.image.findUnique({ where: { id }, select: { mime: true, data: true } });
  if (!image) return new Response('Not found', { status: 404 });

  return new Response(new Uint8Array(image.data), {
    headers: {
      'Content-Type': image.mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
