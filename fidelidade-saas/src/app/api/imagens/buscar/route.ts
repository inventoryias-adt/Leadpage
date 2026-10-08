import { NextResponse } from 'next/server';
import { searchProductImages } from '@/lib/product-images';
import { allow } from '@/lib/rate-limit';
import { getRestaurant } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Busca fotos de produtos por nome ou código de barras. Só para donos logados e com assinatura. */
export async function GET(req: Request) {
  const restaurant = await getRestaurant();
  if (!restaurant || restaurant.subscriptionStatus !== 'ACTIVE') return NextResponse.json({ error: 'Entre na sua conta.' }, { status: 401 });

  const q = (new URL(req.url).searchParams.get('q') ?? '').trim();
  if (q.length < 2 || q.length > 60) return NextResponse.json({ error: 'Digite o nome ou o código de barras do produto.' }, { status: 400 });
  if (!(await allow(`imgsearch:${restaurant.id}`, 40, 600))) return NextResponse.json({ error: 'Muitas buscas seguidas. Aguarde alguns minutos.' }, { status: 429 });

  try {
    return NextResponse.json({ items: await searchProductImages(q) });
  } catch {
    return NextResponse.json({ error: 'Não foi possível buscar agora. Tente de novo em instantes ou envie a foto do seu computador.' }, { status: 502 });
  }
}
