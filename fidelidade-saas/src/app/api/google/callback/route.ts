import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { appUrl } from '@/lib/payments';
import { connectWithCode, googleConfigured } from '@/lib/google-reviews';
import { readState } from '@/lib/google-state';
import { getRestaurant } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BACK = '/dashboard/configuracoes?etapa=negocio';

/** Volta do Google com o código de autorização: guarda o token (cifrado) e a lista de perfis do dono. */
export async function GET(req: Request) {
  const origin = appUrl();
  const url = new URL(req.url);
  const done = (r: string) => NextResponse.redirect(`${origin}${BACK}&google=${r}#unidades`);

  const restaurant = await getRestaurant();
  if (!restaurant) return NextResponse.redirect(`${origin}/login`);
  if (!googleConfigured()) return done('indisponivel');
  if (url.searchParams.get('error')) return done('negado');

  const owner = await readState(url.searchParams.get('state') ?? '');
  const code = url.searchParams.get('code');
  if (!owner || owner !== restaurant.id || !code) return done('erro');

  try {
    const c = await connectWithCode(origin, code);
    await prisma.googleConnection.upsert({
      where: { restaurantId: restaurant.id },
      create: { restaurantId: restaurant.id, refreshTokenEnc: c.refreshTokenEnc, googleEmail: c.email, locations: c.locations },
      update: { refreshTokenEnc: c.refreshTokenEnc, googleEmail: c.email, locations: c.locations, lastError: null },
    });
    return done('ok');
  } catch (e) {
    console.error('[google/callback]', e instanceof Error ? e.message : e);
    return done('erro');
  }
}
