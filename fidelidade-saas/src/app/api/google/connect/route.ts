import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { appUrl } from '@/lib/payments';
import { authUrl, googleConfigured, googleMock, mockLocations } from '@/lib/google-reviews';
import { signState } from '@/lib/google-state';
import { seal } from '@/lib/secret-box';
import { getRestaurant } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BACK = '/dashboard/configuracoes?etapa=negocio';

/** O dono toca em "Ligar com o Google": vai para a tela de autorização (só leitura das avaliações). */
export async function GET() {
  const restaurant = await getRestaurant();
  const origin = appUrl();
  if (!restaurant || restaurant.subscriptionStatus !== 'ACTIVE') return NextResponse.redirect(`${origin}/login`);
  if (!googleConfigured()) return NextResponse.redirect(`${origin}${BACK}&google=indisponivel#unidades`);

  if (googleMock()) {
    // Modo de teste: não sai do app; liga com perfis de mentira lidos do arquivo de teste.
    const locations = await mockLocations();
    await prisma.googleConnection.upsert({
      where: { restaurantId: restaurant.id },
      create: { restaurantId: restaurant.id, refreshTokenEnc: seal('mock'), googleEmail: 'teste@exemplo.com', locations },
      update: { refreshTokenEnc: seal('mock'), googleEmail: 'teste@exemplo.com', locations, lastError: null },
    });
    return NextResponse.redirect(`${origin}${BACK}&google=ok#unidades`);
  }
  return NextResponse.redirect(authUrl(origin, await signState(restaurant.id)));
}
