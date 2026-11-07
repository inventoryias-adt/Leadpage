import 'server-only';
import { SignJWT, jwtVerify } from 'jose';

/** O parâmetro `state` da autorização do Google: assinado, vale 10 minutos e diz de qual lugar é a conexão. */
const key = () => new TextEncoder().encode(process.env.SESSION_SECRET ?? '');

export const signState = (restaurantId: string) =>
  new SignJWT({ k: 'google' }).setProtectedHeader({ alg: 'HS256' }).setSubject(restaurantId).setIssuedAt().setExpirationTime('10m').sign(key());

export async function readState(state: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(state, key());
    return payload.k === 'google' && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}
