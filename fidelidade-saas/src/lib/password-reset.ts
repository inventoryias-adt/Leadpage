import { createHash, randomBytes } from 'node:crypto';

export type ResetKind = 'customer' | 'restaurant';
export const RESET_TTL_MINUTES = 60;
/** Segmentos de URL ("/redefinir/<segmento>/<token>"). */
export const KIND_SEGMENT: Record<ResetKind, string> = { customer: 'cliente', restaurant: 'dono' };
export const segmentKind = (seg: string): ResetKind | null => (seg === 'cliente' ? 'customer' : seg === 'dono' ? 'restaurant' : null);

/** Token aleatório de 256 bits para o link. Só o hash é guardado. */
export const newResetToken = () => randomBytes(32).toString('base64url');
export const hashResetToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const looksLikeToken = (t: string) => /^[A-Za-z0-9_-]{43}$/.test(t);

export function resetEmailText(name: string, url: string): string {
  const first = name.trim().split(/\s+/)[0] || 'olá';
  return [
    `Olá, ${first}!`,
    '',
    'Recebemos um pedido para redefinir a sua senha do Fidelize. Para criar uma senha nova, abra o link abaixo (vale por 1 hora e só pode ser usado uma vez):',
    '',
    url,
    '',
    'Se não foi você, ignore este e-mail: a sua senha continua a mesma.',
  ].join('\n');
}
