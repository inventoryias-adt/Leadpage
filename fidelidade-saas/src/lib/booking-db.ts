import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from './db';
import { BusinessError } from './claims';
import { availableSlots, dayStartUtc, formatBookingWhen, hmOf, parseDateKey, pickResource, type BusyRange, type Slot } from './booking';
import { parseSchedule } from './hours';
import { notify } from './notifications';

type Db = Prisma.TransactionClient | typeof prisma;
const DAY_MS = 24 * 60 * 60 * 1000;

type Policy = { bookingMinNoticeMin: number; bookingMaxDaysAhead: number };
type ServiceLike = { id: string; durationMin: number; resourceId: string | null };

/** Horários livres de um serviço numa unidade em um dia, com o que está ocupado (para escolher o profissional). */
export async function slotsForDay(
  db: Db,
  args: { restaurantId: string; policy: Policy; service: ServiceLike; unit: { id: string; openingSchedule: unknown }; date: string; now?: Date },
): Promise<{ slots: Slot[]; busy: BusyRange[] }> {
  const { restaurantId, policy, service, unit, date } = args;
  if (!parseDateKey(date)) return { slots: [], busy: [] };
  const resources = await db.resource.findMany({
    where: {
      restaurantId,
      active: true,
      OR: [{ unitId: null }, { unitId: unit.id }],
      ...(service.resourceId ? { id: service.resourceId } : {}),
    },
    select: { id: true, capacity: true },
    orderBy: { createdAt: 'asc' },
  });
  if (resources.length === 0) return { slots: [], busy: [] };
  const start = dayStartUtc(date);
  const busy = await db.booking.findMany({
    where: {
      resourceId: { in: resources.map((r) => r.id) },
      status: { in: ['PENDING', 'CONFIRMED'] },
      startsAt: { lt: new Date(start.getTime() + 2 * DAY_MS) },
      endsAt: { gt: start },
    },
    select: { resourceId: true, startsAt: true, endsAt: true },
  });
  const slots = availableSlots({
    date,
    schedule: parseSchedule(unit.openingSchedule),
    durationMin: service.durationMin,
    resources,
    busy,
    now: args.now ?? new Date(),
    minNoticeMin: policy.bookingMinNoticeMin,
    maxDaysAhead: policy.bookingMaxDaysAhead,
  });
  return { slots, busy };
}

export type BookInput = { restaurantId: string; serviceId: string; unitId: string; date: string; time: string; partySize?: number | null; note?: string };

const MAX_ACTIVE_PER_PLACE = 5;

/** Cria o agendamento de forma segura contra duas pessoas pegando o mesmo horário ao mesmo tempo. */
export async function bookSlot(customerId: string, input: BookInput) {
  return prisma.$transaction(
    async (tx) => {
      // Um cadeado por estabelecimento: quem chega depois espera e então já enxerga o horário ocupado.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.restaurantId}))`;

      const restaurant = await tx.restaurant.findUnique({ where: { id: input.restaurantId } });
      if (!restaurant || restaurant.subscriptionStatus !== 'ACTIVE' || !restaurant.onboardedAt) throw new BusinessError('Este lugar não está recebendo agendamentos agora.');
      const [service, unit] = await Promise.all([
        tx.service.findFirst({ where: { id: input.serviceId, restaurantId: restaurant.id, active: true } }),
        tx.unit.findFirst({ where: { id: input.unitId, restaurantId: restaurant.id, active: true } }),
      ]);
      if (!service) throw new BusinessError('Este serviço não está mais disponível.');
      if (!unit) throw new BusinessError('Unidade não encontrada.');
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) throw new BusinessError('Horário inválido.');

      let partySize: number | null = null;
      if (service.askPartySize) {
        partySize = Number(input.partySize);
        if (!Number.isInteger(partySize) || partySize < 1 || partySize > 30) throw new BusinessError('Informe quantas pessoas (de 1 a 30).');
      }

      const { slots, busy } = await slotsForDay(tx, { restaurantId: restaurant.id, policy: restaurant, service, unit, date: input.date });
      const slot = slots.find((s) => s.time === input.time);
      if (!slot) throw new BusinessError('Esse horário acabou de ser ocupado ou não está mais disponível. Escolha outro.');
      const resourceId = pickResource(slot.resourceIds, busy);
      if (!resourceId) throw new BusinessError('Esse horário não está mais disponível. Escolha outro.');

      const endsAt = new Date(slot.startsAt.getTime() + service.durationMin * 60_000);
      const clash = await tx.booking.count({
        where: { customerId, restaurantId: restaurant.id, status: { in: ['PENDING', 'CONFIRMED'] }, startsAt: { lt: endsAt }, endsAt: { gt: slot.startsAt } },
      });
      if (clash) throw new BusinessError('Você já tem um agendamento neste horário.');
      const active = await tx.booking.count({ where: { customerId, restaurantId: restaurant.id, status: { in: ['PENDING', 'CONFIRMED'] }, startsAt: { gt: new Date() } } });
      if (active >= MAX_ACTIVE_PER_PLACE) throw new BusinessError(`Você já tem ${MAX_ACTIVE_PER_PLACE} agendamentos em aberto neste lugar. Conclua ou cancele algum para marcar outro.`);

      const auto = restaurant.bookingAutoConfirm;
      const booking = await tx.booking.create({
        data: {
          restaurantId: restaurant.id,
          unitId: unit.id,
          customerId,
          serviceId: service.id,
          resourceId,
          startsAt: slot.startsAt,
          endsAt,
          status: auto ? 'CONFIRMED' : 'PENDING',
          confirmedAt: auto ? new Date() : null,
          serviceName: service.name,
          durationMin: service.durationMin,
          priceCents: service.priceCents,
          partySize,
          note: input.note?.trim().slice(0, 300) || null,
        },
      });
      await notify(tx, {
        customerId,
        restaurantId: restaurant.id,
        title: auto ? 'Agendamento confirmado' : 'Pedido de agendamento enviado',
        body: `${service.name} · ${formatBookingWhen(slot.startsAt)} · ${restaurant.name}${auto ? '' : '. O lugar vai confirmar em breve.'}`,
        href: '/perfil/agendamentos',
      });
      return booking;
    },
    { timeout: 15_000 },
  );
}

/** O cliente cancela o próprio agendamento (regra de antecedência é conferida por quem chama). */
export async function cancelBooking(id: string, by: 'CUSTOMER' | 'OWNER', where: { customerId?: string; restaurantId?: string }) {
  const booking = await prisma.booking.findFirst({ where: { id, ...where, status: { in: ['PENDING', 'CONFIRMED'] } } });
  if (!booking) throw new BusinessError('Agendamento não encontrado ou já encerrado.');
  const done = await prisma.booking.updateMany({
    where: { id, status: { in: ['PENDING', 'CONFIRMED'] } },
    data: { status: 'CANCELED', canceledAt: new Date(), canceledBy: by },
  });
  if (done.count !== 1) throw new BusinessError('Agendamento não encontrado ou já encerrado.');
  return booking;
}

export const bookingTime = (b: { startsAt: Date }) => hmOf(b.startsAt);
