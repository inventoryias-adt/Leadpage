import { NextResponse } from 'next/server';
import { hasCosmosApi, searchProducts } from '@/lib/product-images';
import { allow } from '@/lib/rate-limit';
import { getRestaurant } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** Busca fotos de produtos por nome ou código de barras. Só para donos logados e com assinatura. */
export async function GET(req: Request) {
  const restaurant = await getRestaurant();
  if (!restaurant || restaurant.subscriptionStatus !== 'ACTIVE') return NextResponse.json({ error: 'Entre na sua conta.' }, { status: 401 });

  const q = (new URL(req.url).searchParams.get('q') ?? '').trim();
  if (q.length < 2 || q.length > 60) return NextResponse.json({ error: 'Digite o nome ou o código de barras do produto.' }, { status: 400 });
  if (!(await allow(`imgsearch:${restaurant.id}`, 40, 600))) return NextResponse.json({ error: 'Muitas buscas seguidas. Aguarde alguns minutos.' }, { status: 429 });

  try {
    const { items, warnings } = await searchProducts(q);
    if (items.length === 0 && warnings.length > 0) {
      console.error('[imagens] sem resultado e com falhas:', warnings.join('; '));
      return NextResponse.json({ error: `Não foi possível buscar agora (${warnings.join('; ')}). Tente de novo em instantes ou envie a foto do seu computador.` }, { status: 502 });
    }
    if (warnings.length > 0) console.warn('[imagens] fontes com falha:', warnings.join('; '));
    return NextResponse.json({ items, partial: warnings.length > 0, bluesoft: hasCosmosApi() });
  } catch (e) {
    console.error('[imagens] erro inesperado', e);
    return NextResponse.json({ error: 'Não foi possível buscar agora. Tente de novo em instantes ou envie a foto do seu computador.' }, { status: 502 });
  }
}
