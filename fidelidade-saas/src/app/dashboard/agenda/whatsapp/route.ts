import { NextResponse } from 'next/server';
import { PERIODS, periodRange, rangeBounds, whatsappUrl, type AgendaPeriod } from '@/lib/agenda-export';
import { guestOf, parseDateKey, todayKey } from '@/lib/booking';
import { prisma } from '@/lib/db';
import { getRestaurant } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * "Enviar pelo WhatsApp": monta a agenda do período e do atendente escolhidos e manda para o WhatsApp.
 * ?data=AAAA-MM-DD&per=dia|semana|mes|mes-passado&prof=<atendente ou vazio = todos>&para=atendente|escolher
 * Com "para=atendente" (e número cadastrado) abre a conversa com ele; senão o WhatsApp deixa escolher o contato.
 * Só para o dono logado; atendente de outro estabelecimento é ignorado.
 */
export async function GET(req: Request) {
  const restaurant = await getRestaurant();
  if (!restaurant || restaurant.subscriptionStatus !== 'ACTIVE') return NextResponse.json({ error: 'Entre na sua conta.' }, { status: 401 });

  const q = new URL(req.url).searchParams;
  const date = q.get('data') && parseDateKey(q.get('data')!) ? q.get('data')! : todayKey();
  const per: AgendaPeriod = (PERIODS as readonly string[]).includes(q.get('per') ?? '') ? (q.get('per') as AgendaPeriod) : 'dia';
  const range = periodRange(per, date);
  const { start, end } = rangeBounds(range.from, range.to);
  const profId = q.get('prof') ?? '';
  const who = /^[0-9a-f-]{36}$/.test(profId) ? await prisma.resource.findFirst({ where: { id: profId, restaurantId: restaurant.id }, select: { id: true, name: true, phone: true } }) : null;

  const rows = await prisma.booking.findMany({
    where: { restaurantId: restaurant.id, startsAt: { gte: start, lt: end }, ...(who ? { resourceId: who.id } : {}) },
    orderBy: { startsAt: 'asc' },
    include: { customer: { select: { name: true, phone: true } }, resource: { select: { name: true } } },
  });

  const { href } = whatsappUrl(
    rows.map((b) => ({
      startsAt: b.startsAt, endsAt: b.endsAt, serviceName: b.serviceName, customerName: guestOf(b).name, customerPhone: guestOf(b).phone,
      resourceName: b.resource?.name ?? null, status: b.status, priceCents: b.priceCents, discountCents: b.discountCents, partySize: b.partySize, note: b.note,
    })),
    { who: who?.name ?? null, label: range.label, phone: q.get('para') === 'atendente' ? who?.phone ?? null : null },
  );
  const res = NextResponse.redirect(href, 302);
  res.headers.set('Cache-Control', 'private, no-store');
  return res;
}
