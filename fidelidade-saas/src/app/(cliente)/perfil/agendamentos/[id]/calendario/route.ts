import { NextResponse } from 'next/server';
import { buildIcs } from '@/lib/calendar-links';
import { prisma } from '@/lib/db';
import { getCustomer } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Arquivo .ics do agendamento (só do próprio cliente): abre no calendário do celular ou do computador. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await getCustomer();
  if (!customer) return NextResponse.redirect(new URL(`/entrar?next=${encodeURIComponent(`/perfil/agendamentos`)}`, process.env.APP_URL ?? 'http://localhost:3000'));
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse('Agendamento não encontrado.', { status: 404 });
  const b = await prisma.booking.findFirst({
    where: { id, customerId: customer.id, status: { in: ['PENDING', 'CONFIRMED'] } },
    include: { restaurant: { select: { name: true } }, unit: { select: { address: true } }, resource: { select: { name: true } } },
  });
  if (!b) return new NextResponse('Agendamento não encontrado.', { status: 404 });
  const ics = buildIcs({
    uid: b.id,
    title: `${b.serviceName} · ${b.restaurant.name}`,
    startsAt: b.startsAt,
    endsAt: b.endsAt,
    location: b.unit.address ?? b.restaurant.name,
    description: `${b.resource ? `Com ${b.resource.name}. ` : ''}Agendado pelo Fidelize.`,
  });
  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="agendamento-${b.id.slice(0, 8)}.ics"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
