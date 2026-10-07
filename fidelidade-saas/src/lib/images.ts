import 'server-only';
import { prisma } from './db';
import { BusinessError } from './claims';

const MAX_BYTES = 450 * 1024; // o navegador já reduz para ~100 KB; isto é só a trava de segurança

/** Confere o tipo real pelos primeiros bytes — não confiamos no que o navegador declara. */
function sniffMime(buf: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 12 && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}

/**
 * Salva a foto enviada pelo formulário (data URL gerada no navegador) e devolve o id.
 * Se `previousId` existir, a foto antiga é apagada.
 */
export async function saveImageFromDataUrl(restaurantId: string, dataUrl: string, previousId?: string | null) {
  const match = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new BusinessError('Imagem inválida. Use JPG, PNG ou WebP.');
  const data = Buffer.from(match[1], 'base64');
  if (data.length > MAX_BYTES) throw new BusinessError('Imagem muito grande. Escolha uma foto menor.');
  const mime = sniffMime(data);
  if (!mime) throw new BusinessError('Imagem inválida. Use JPG, PNG ou WebP.');

  const image = await prisma.image.create({ data: { restaurantId, mime, data } });
  if (previousId) await prisma.image.deleteMany({ where: { id: previousId, restaurantId } });
  return image.id;
}

export const imageUrl = (id: string | null | undefined) => (id ? `/api/imagem/${id}` : null);
