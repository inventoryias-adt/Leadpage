import { NextResponse } from 'next/server';
import { PERIODS, periodRange, rangeBounds, toCsv, type AgendaPeriod } from '@/lib/agenda-export';
import { guestOf, parseDateKey, todayKey } from '@/lib/booking';
import { prisma } from '@/lib/db';
import { getRestaurant } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Planilha (CSV) da agenda do período, com ou sem filtro de profissional. Só para o dono logado. */
export async function GET(req: Request) {
  const restaurant = await getRestaurant();
  if (!restaurant || restaurant.subscriptionStatus !== 'ACTIVE') return NextResponse.json({ error: 'Entre na sua conta.' }, { status: 401 });

  const q = new URL(req.url).searchParams;
  const date = q.get('data') && parseDateKey(q.get('data')!) ? q.get('data')! : todayKey();
  const per: AgendaPeriod = (PERIODS as readonly string[]).includes(q.get('per') ?? '') ? (q.get('per') as AgendaPeriod) : 'dia';
  const range = periodRange(per, date);
  const { start, end } = rangeBounds(range.from, range.to);
  const prof = q.get('prof');

  const [rows, who] = await Promise.all([
    prisma.booking.findMany({
      where: { restaurantId: restaurant.id, startsAt: { gte: start, lt: end }, ...(prof ? { resourceId: prof } : {}) },
      orderBy: { startsAt: 'asc' },
      include: { customer: { select: { name: true, phone: true } }, resource: { select: { name: true } } },
    }),
    prof ? prisma.resource.findFirst({ where: { id: prof, restaurantId: restaurant.id }, select: { name: true } }) : null,
  ]);

  const csv = toCsv(
    rows.map((b) => ({
      startsAt: b.startsAt, endsAt: b.endsAt, serviceName: b.serviceName, customerName: guestOf(b).name, customerPhone: guestOf(b).phone,
      resourceName: b.resource?.name ?? null, status: b.status, priceCents: b.priceCents, discountCents: b.discountCents, partySize: b.partySize, note: b.note,
    })),
  );
  const slug = (who?.name ?? 'todos').normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'agenda';
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="agenda-${slug}-${range.from}_${range.to}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
