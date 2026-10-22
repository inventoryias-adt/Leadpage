import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from './db';
import { BusinessError, creditClaimWith } from './claims';
import { REMINDER_LEAD_MIN, REMINDER_MIN_AHEAD_MIN, availableSlots, bookingPoints, canCustomerCancel, dateKeyOf, dayOccupancy, dayStartUtc, inPeriod, isWaitPeriod, formatBookingWhen, guestOf, hmOf, addDaysKey, timeOffBusy, withBuffer, nearestSlots, parseDateKey, pickResource, reminderDue, todayKey, type BusyRange, type Slot } from './booking';
import { suggestsBooking } from './categories';
import { parseSchedule } from './hours';
import { sendEmail } from './mailer';
import { notify } from './notifications';
import { askForReview } from './reviews-db';
import { applyPoints } from './points-discount';
import { appUrl } from './payments';
import { formatBRL } from './points';
import { formatPhone, isValidCpf, normalizePhone, onlyDigits } from './br';
import { newClaimToken } from './tokens';

type Db = Prisma.TransactionClient | typeof prisma;

/** O horário escolhido já não está livre (alguém fechou antes). Quem captura mostra outras opções ao cliente. */
export class SlotGoneError extends BusinessError {}

/** Por quantos minutos um horário fica segurado para quem está confirmando. */
export const HOLD_MIN = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

type Policy = { bookingMinNoticeMin: number; bookingMaxDaysAhead: number; bookingBufferMin?: number };
type ServiceLike = { id: string; durationMin: number; resourceId: string | null };

/**
 * Lugar de categoria que atende com hora marcada (barbearia, estética…) e ainda sem nenhum serviço: cria o serviço padrão
 * "Atendimento" (30 min, sem preço), para o cliente já poder agendar. O dono troca por serviços de verdade quando quiser.
 * Devolve true se criou. Com cadeado por estabelecimento, para não criar dois.
 */
export async function ensureDefaultService(restaurant: { id: string; category: string | null; subscriptionStatus: string; onboardedAt: Date | null }) {
  if (!suggestsBooking(restaurant.category) || restaurant.subscriptionStatus !== 'ACTIVE' || !restaurant.onboardedAt) return false;
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${restaurant.id}))`;
    if (await tx.service.count({ where: { restaurantId: restaurant.id, active: true } })) return false;
    await tx.service.create({ data: { restaurantId: restaurant.id, name: 'Atendimento', durationMin: 30, priceCents: 0 } });
    return true;
  });
}

/**
 * Quem não cadastrou nenhum profissional tem um atendente só: cria a vaga única "Atendimento" na hora, para o cliente agendar normalmente.
 * (Cobre o caso de a vaga padrão ter sido removida ou nunca ter existido.) Com cadeado por estabelecimento, para não criar duas.
 */
export async function ensureDefaultStaff(restaurantId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${restaurantId}))`;
    if (!(await tx.resource.count({ where: { restaurantId, active: true } }))) {
      await tx.resource.create({ data: { restaurantId, name: 'Atendimento', capacity: 1 } });
    }
  });
}

/** Profissionais que podem fazer o serviço nesta unidade, com a duração e a escala de cada um. */
export async function staffFor(db: Db, args: { restaurantId: string; service: ServiceLike; unitId: string; resourceId?: string | null }) {
  const { restaurantId, service, unitId } = args;
  if (!args.resourceId && !(await db.resource.count({ where: { restaurantId, active: true } }))) {
    // Dentro do agendamento (transação) o cadeado do estabelecimento já está nas nossas mãos: cria direto, sem esperar outra transação.
    if ('$transaction' in db) await ensureDefaultStaff(restaurantId);
    else await db.resource.create({ data: { restaurantId, name: 'Atendimento', capacity: 1 } });
  }
  const links = await db.resourceService.findMany({ where: { serviceId: service.id }, select: { resourceId: true, durationMin: true } });
  const linked = new Map(links.map((l) => [l.resourceId, l.durationMin]));
  const legacy = service.resourceId ? [service.resourceId] : null;
  const resources = await db.resource.findMany({
    where: { restaurantId, active: true, OR: [{ unitId: null }, { unitId }], ...(args.resourceId ? { id: args.resourceId } : {}) },
    orderBy: { createdAt: 'asc' },
  });
  // Serviço sem nenhuma ligação (e sem profissional fixo antigo) é feito por qualquer um.
  const eligible = resources.filter((r) => (links.length > 0 ? linked.has(r.id) : legacy ? legacy.includes(r.id) : true));
  return eligible.map((r) => ({
    id: r.id,
    name: r.name,
    photoImageId: r.photoImageId,
    color: r.color,
    capacity: r.capacity,
    durationMin: linked.get(r.id) ?? service.durationMin,
    schedule: parseSchedule(r.schedule),
  }));
}

/** Horários livres de um serviço numa unidade em um dia, com o que está ocupado (para escolher o profissional). */
export async function slotsForDay(
  db: Db,
  args: { restaurantId: string; policy: Policy; service: ServiceLike; unit: { id: string; openingSchedule: unknown }; date: string; now?: Date; resourceId?: string | null; ignoreBookingId?: string; customerId?: string },
): Promise<{ slots: Slot[]; busy: BusyRange[] }> {
  const { restaurantId, policy, service, unit, date } = args;
  if (!parseDateKey(date)) return { slots: [], busy: [] };
  const staff = await staffFor(db, { restaurantId, service, unitId: unit.id, resourceId: args.resourceId });
  if (staff.length === 0) return { slots: [], busy: [] };
  const start = dayStartUtc(date);
  const now = args.now ?? new Date();
  const busyBookings = await db.booking.findMany({
    where: {
      resourceId: { in: staff.map((r) => r.id) },
      ...(args.ignoreBookingId ? { id: { not: args.ignoreBookingId } } : {}), // reagendando: o horário atual do próprio cliente não conta como ocupado
      status: { in: ['PENDING', 'CONFIRMED'] },
      startsAt: { lt: new Date(start.getTime() + 2 * DAY_MS) },
      endsAt: { gt: start },
    },
    select: { resourceId: true, startsAt: true, endsAt: true },
  });
  // Horários que outras pessoas estão confirmando agora (a reserva de poucos minutos) também contam como ocupados; a do próprio cliente não.
  const holds = await db.slotHold.findMany({
    where: {
      resourceId: { in: staff.map((r) => r.id) },
      expiresAt: { gt: now },
      ...(args.customerId ? { customerId: { not: args.customerId } } : {}),
      startsAt: { lt: new Date(start.getTime() + 2 * DAY_MS) },
      endsAt: { gt: start },
    },
    select: { resourceId: true, startsAt: true, endsAt: true },
  });
  // Folgas e bloqueios (do profissional ou de todos) tiram o horário da agenda; o intervalo entre atendimentos vale só para agendamentos e reservas.
  const staffIds = staff.map((r) => r.id);
  const offs = await db.timeOff.findMany({
    where: {
      restaurantId,
      startsAt: { lt: new Date(start.getTime() + 2 * DAY_MS) },
      endsAt: { gt: start },
      AND: [{ OR: [{ unitId: null }, { unitId: unit.id }] }, { OR: [{ resourceId: null }, { resourceId: { in: staffIds } }] }],
    },
    select: { resourceId: true, startsAt: true, endsAt: true },
  });
  const busy: BusyRange[] = [...withBuffer([...busyBookings, ...holds], policy.bookingBufferMin ?? 0), ...timeOffBusy(offs, staffIds)];
  const slots = availableSlots({
    date,
    schedule: parseSchedule(unit.openingSchedule),
    durationMin: service.durationMin,
    resources: staff.map((r) => ({ id: r.id, capacity: r.capacity, durationMin: r.durationMin, schedule: r.schedule })),
    busy,
    now,
    minNoticeMin: policy.bookingMinNoticeMin,
    maxDaysAhead: policy.bookingMaxDaysAhead,
  });
  return { slots, busy };
}

export type FreeSlot = { date: string; time: string };
type DayArgs = { restaurantId: string; policy: Policy; service: ServiceLike; unit: { id: string; openingSchedule: unknown }; resourceId?: string | null; customerId?: string; ignoreBookingId?: string };

/** Os próximos horários livres a partir de um dia (até `days` dias à frente): o primeiro de cada dia, para dar opções variadas. */
export async function firstFreeSlots(db: Db, args: DayArgs & { from: string; days?: number; limit?: number }): Promise<FreeSlot[]> {
  const out: FreeSlot[] = [];
  const limit = args.limit ?? 3;
  for (let i = 0; i < (args.days ?? 14) && out.length < limit; i++) {
    const date = addDaysKey(args.from, i);
    const { slots } = await slotsForDay(db, { ...args, date });
    if (slots[0]) out.push({ date, time: slots[0].time });
  }
  return out;
}

/** Saídas para quem perdeu o horário: os mais próximos no mesmo dia e, se faltar, o primeiro de cada um dos próximos dias. */
export async function alternativeSlots(db: Db, args: DayArgs & { date: string; time: string; limit?: number }): Promise<FreeSlot[]> {
  const limit = args.limit ?? 3;
  const { slots } = await slotsForDay(db, args);
  const out: FreeSlot[] = nearestSlots(slots, args.time, limit).map((s) => ({ date: args.date, time: s.time }));
  if (out.length < limit) out.push(...(await firstFreeSlots(db, { ...args, from: addDaysKey(args.date, 1), days: 7, limit: limit - out.length })));
  return out;
}

export type HoldInput = { restaurantId: string; serviceId: string; unitId: string; date: string; time: string; resourceId?: string | null };

/**
 * Segura o horário para o cliente por HOLD_MIN minutos enquanto ele confirma: some da lista dos outros e volta sozinho se ele
 * desistir. Cada cliente segura um horário por vez em cada lugar. Mesmo cadeado do agendamento, então não há corrida.
 */
export async function holdSlot(customerId: string, input: HoldInput) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.restaurantId}))`;
      const restaurant = await tx.restaurant.findUnique({ where: { id: input.restaurantId } });
      if (!restaurant || restaurant.subscriptionStatus !== 'ACTIVE' || !restaurant.onboardedAt) throw new BusinessError('Este lugar não está recebendo agendamentos agora.');
      const [service, unit] = await Promise.all([
        tx.service.findFirst({ where: { id: input.serviceId, restaurantId: restaurant.id, active: true } }),
        tx.unit.findFirst({ where: { id: input.unitId, restaurantId: restaurant.id, active: true } }),
      ]);
      if (!service || !unit) throw new BusinessError('Este serviço não está mais disponível.');
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) throw new BusinessError('Horário inválido.');
      const now = new Date();
      await tx.slotHold.deleteMany({ where: { restaurantId: restaurant.id, expiresAt: { lte: now } } }); // limpeza das reservas vencidas

      const { slots, busy } = await slotsForDay(tx, { restaurantId: restaurant.id, policy: restaurant, service, unit, date: input.date, resourceId: input.resourceId || null, customerId, now });
      const slot = slots.find((s) => s.time === input.time);
      if (!slot) throw new SlotGoneError('Esse horário acabou de ser ocupado ou não está mais disponível.');
      const resourceId = pickResource(slot.resourceIds, busy);
      if (!resourceId) throw new SlotGoneError('Esse horário não está mais disponível.');
      const durationMin = slot.durationByResource[resourceId] ?? service.durationMin;
      const endsAt = new Date(slot.startsAt.getTime() + durationMin * 60_000);
      const expiresAt = new Date(now.getTime() + HOLD_MIN * 60_000);
      const data = { unitId: unit.id, resourceId, startsAt: slot.startsAt, endsAt, expiresAt };
      await tx.slotHold.upsert({ where: { customerId_restaurantId: { customerId, restaurantId: restaurant.id } }, create: { customerId, restaurantId: restaurant.id, ...data }, update: data });
      return { expiresAt, resourceId };
    },
    { timeout: 15_000 },
  );
}

export type BookInput = { restaurantId: string; serviceId: string; unitId: string; date: string; time: string; partySize?: number | null; note?: string; usePoints?: number; resourceId?: string | null };

const MAX_ACTIVE_PER_PLACE = 5;

/** Cria o agendamento de forma segura contra duas pessoas pegando o mesmo horário ao mesmo tempo. */
export async function bookSlot(customerId: string, input: BookInput) {
  const booking = await bookSlotTx(customerId, input);
  // O aviso ao profissional não pode derrubar o agendamento (e-mail fora do ar, por exemplo).
  void notifyStaff(booking.id).catch((e) => console.error('Falha ao avisar a equipe', e instanceof Error ? e.message : e));
  return booking;
}

async function bookSlotTx(customerId: string, input: BookInput) {
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

      const { slots, busy } = await slotsForDay(tx, { restaurantId: restaurant.id, policy: restaurant, service, unit, date: input.date, resourceId: input.resourceId || null, customerId });
      const slot = slots.find((s) => s.time === input.time);
      if (!slot) throw new SlotGoneError('Esse horário acabou de ser ocupado ou não está mais disponível. Escolha outro.');
      // Se o cliente tinha este horário reservado, fica com o mesmo profissional da reserva.
      const mine = await tx.slotHold.findUnique({ where: { customerId_restaurantId: { customerId, restaurantId: restaurant.id } } });
      const held = mine && mine.expiresAt > new Date() && mine.startsAt.getTime() === slot.startsAt.getTime() && slot.resourceIds.includes(mine.resourceId) ? mine.resourceId : null;
      const resourceId = held ?? pickResource(slot.resourceIds, busy);
      if (!resourceId) throw new SlotGoneError('Esse horário não está mais disponível. Escolha outro.');
      const durationMin = slot.durationByResource[resourceId] ?? service.durationMin; // cada profissional leva o seu tempo
      const endsAt = new Date(slot.startsAt.getTime() + durationMin * 60_000);
      const clash = await tx.booking.count({
        where: { customerId, restaurantId: restaurant.id, status: { in: ['PENDING', 'CONFIRMED'] }, startsAt: { lt: endsAt }, endsAt: { gt: slot.startsAt } },
      });
      if (clash) throw new BusinessError('Você já tem um agendamento neste horário.');
      const active = await tx.booking.count({ where: { customerId, restaurantId: restaurant.id, status: { in: ['PENDING', 'CONFIRMED'] }, startsAt: { gt: new Date() } } });
      if (active >= MAX_ACTIVE_PER_PLACE) throw new BusinessError(`Você já tem ${MAX_ACTIVE_PER_PLACE} agendamentos em aberto neste lugar. Conclua ou cancele algum para marcar outro.`);

      // Pontos como desconto: tudo é conferido aqui, com o saldo travado (nada vem pronto do navegador).
      let pointsUsed = 0;
      let discountCents = 0;
      const wanted = Math.floor(Number(input.usePoints ?? 0));
      if (wanted > 0) {
        const found = await tx.wallet.findUnique({ where: { customerId_restaurantId: { customerId, restaurantId: restaurant.id } } });
        if (!found) throw new BusinessError('Você ainda não tem pontos neste lugar.');
        await tx.$queryRaw`SELECT id FROM "Wallet" WHERE id = ${found.id} FOR UPDATE`;
        const wallet = await tx.wallet.findUniqueOrThrow({ where: { id: found.id } });
        const applied = applyPoints(wanted, { priceCents: service.priceCents, maxPct: service.pointsDiscountMaxPct, rate: restaurant.pointsPerRealOff, balance: wallet.balance });
        if ('error' in applied) throw new BusinessError(applied.error);
        pointsUsed = applied.points;
        discountCents = applied.discountCents;
        await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { decrement: pointsUsed } } });
        await tx.transaction.create({ data: { walletId: wallet.id, type: 'REDEEM', points: pointsUsed, description: `Desconto no agendamento: ${service.name}` } });
      }

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
          durationMin,
          priceCents: service.priceCents,
          partySize,
          note: input.note?.trim().slice(0, 300) || null,
          pointsUsed,
          discountCents,
        },
      });
      await tx.slotHold.deleteMany({ where: { customerId, restaurantId: restaurant.id } });
      // Quem estava na lista de espera deste serviço neste dia e conseguiu marcar sai da fila.
      await tx.waitlistEntry.updateMany({ where: { customerId, restaurantId: restaurant.id, serviceId: service.id, date: input.date, status: 'WAITING' }, data: { status: 'BOOKED' } });
      await notify(tx, {
        customerId,
        restaurantId: restaurant.id,
        title: auto ? 'Agendamento confirmado' : 'Pedido de agendamento enviado',
        body: `${service.name} · ${formatBookingWhen(slot.startsAt)} · ${restaurant.name}${discountCents > 0 ? ` · desconto de ${formatBRL(discountCents)} com ${pointsUsed.toLocaleString('pt-BR')} pontos` : ''}${auto ? '' : '. O lugar vai confirmar em breve.'}`,
        href: '/perfil/agendamentos',
      });
      return booking;
    },
    { timeout: 15_000 },
  );
}

export type OwnerBookInput = {
  serviceId: string;
  unitId: string;
  date: string;
  time: string;
  resourceId?: string | null;
  /** CPF de quem já tem conta no app; vazio = encaixe de quem não tem (nome e telefone abaixo). */
  cpf?: string;
  guestName?: string;
  guestPhone?: string;
  partySize?: number | null;
  note?: string;
};

/**
 * O próprio lugar marca um horário (encaixe de balcão, telefone ou WhatsApp). Passa pela mesma trava e pelas mesmas regras de
 * disponibilidade do cliente (profissional, expediente, folgas, intervalo e reservas de outros), mas sem antecedência mínima
 * e já confirmado. Quem tem conta (CPF) recebe o aviso e os pontos na conclusão; quem não tem fica só com nome e telefone.
 */
export async function ownerBookSlot(restaurantId: string, input: OwnerBookInput) {
  const booking = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${restaurantId}))`;
      const restaurant = await tx.restaurant.findUnique({ where: { id: restaurantId } });
      if (!restaurant || restaurant.subscriptionStatus !== 'ACTIVE') throw new BusinessError('Estabelecimento não encontrado.');
      const [service, unit] = await Promise.all([
        tx.service.findFirst({ where: { id: input.serviceId, restaurantId, active: true } }),
        tx.unit.findFirst({ where: { id: input.unitId, restaurantId, active: true } }),
      ]);
      if (!service) throw new BusinessError('Escolha o serviço.');
      if (!unit) throw new BusinessError('Escolha a unidade.');
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) throw new BusinessError('Escolha o horário.');
      let partySize: number | null = null;
      if (service.askPartySize) {
        partySize = Number(input.partySize);
        if (!Number.isInteger(partySize) || partySize < 1 || partySize > 30) throw new BusinessError('Informe quantas pessoas (de 1 a 30).');
      }

      // Quem é o cliente: conta existente (CPF) ou convidado (nome + telefone).
      const cpf = onlyDigits(input.cpf ?? '');
      let customerId: string | null = null;
      let guestName: string | null = null;
      let guestPhone: string | null = null;
      if (cpf) {
        if (!isValidCpf(cpf)) throw new BusinessError('CPF inválido.');
        const customer = await tx.customer.findUnique({ where: { cpf }, select: { id: true } });
        if (!customer) throw new BusinessError('Nenhum cliente com esse CPF no app. Deixe o CPF em branco e informe nome e telefone.');
        customerId = customer.id;
      } else {
        guestName = (input.guestName ?? '').trim().slice(0, 80);
        if (guestName.length < 2) throw new BusinessError('Informe o CPF do cliente ou o nome dele.');
        guestPhone = normalizePhone(input.guestPhone ?? '');
        if (!guestPhone) throw new BusinessError('Informe o telefone do cliente com DDD.');
      }

      const { slots, busy } = await slotsForDay(tx, {
        restaurantId,
        policy: { bookingMinNoticeMin: 0, bookingMaxDaysAhead: 365, bookingBufferMin: restaurant.bookingBufferMin },
        service,
        unit,
        date: input.date,
        resourceId: input.resourceId || null,
      });
      const slot = slots.find((s) => s.time === input.time);
      if (!slot) throw new SlotGoneError('Esse horário não está mais livre (ocupado, fora do expediente ou em folga). Escolha outro.');
      const resourceId = pickResource(slot.resourceIds, busy);
      if (!resourceId) throw new SlotGoneError('Esse horário não está mais livre. Escolha outro.');
      const durationMin = slot.durationByResource[resourceId] ?? service.durationMin;
      const endsAt = new Date(slot.startsAt.getTime() + durationMin * 60_000);

      const created = await tx.booking.create({
        data: {
          restaurantId,
          unitId: unit.id,
          customerId,
          guestName,
          guestPhone,
          createdBy: 'OWNER',
          serviceId: service.id,
          resourceId,
          startsAt: slot.startsAt,
          endsAt,
          status: 'CONFIRMED',
          confirmedAt: new Date(),
          serviceName: service.name,
          durationMin,
          priceCents: service.priceCents,
          partySize,
          note: input.note?.trim().slice(0, 300) || null,
        },
      });
      if (customerId) {
        await notify(tx, {
          customerId,
          restaurantId,
          title: 'O lugar marcou um horário para você',
          body: `${service.name} · ${formatBookingWhen(slot.startsAt)} · ${restaurant.name}`,
          href: '/perfil/agendamentos',
        });
      }
      return created;
    },
    { timeout: 15_000 },
  );
  void notifyStaff(booking.id).catch((e) => console.error('Falha ao avisar a equipe', e instanceof Error ? e.message : e));
  return booking;
}

export type RescheduleInput = { date: string; time: string; resourceId?: string | null };

/**
 * O cliente troca o dia, o horário e/ou o profissional de um agendamento em aberto. Serviço, unidade, preço e o desconto com
 * pontos continuam os mesmos. Vale a mesma antecedência do cancelamento. O novo horário passa pelas mesmas regras de
 * disponibilidade (com o cadeado do estabelecimento) e, se o lugar confirma na mão, volta a aguardar confirmação.
 */
export async function rescheduleBooking(customerId: string, bookingId: string, input: RescheduleInput) {
  const result = await prisma.$transaction(
    async (tx) => {
      const found = await tx.booking.findFirst({ where: { id: bookingId, customerId }, select: { restaurantId: true } });
      if (!found) throw new BusinessError('Agendamento não encontrado.');
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${found.restaurantId}))`;

      const booking = await tx.booking.findFirst({ where: { id: bookingId, customerId, status: { in: ['PENDING', 'CONFIRMED'] } }, include: { resource: { select: { name: true } } } });
      if (!booking) throw new BusinessError('Agendamento não encontrado ou já encerrado.');
      const restaurant = await tx.restaurant.findUnique({ where: { id: booking.restaurantId } });
      if (!restaurant || restaurant.subscriptionStatus !== 'ACTIVE') throw new BusinessError('Este lugar não está recebendo agendamentos agora.');
      if (!canCustomerCancel(booking, restaurant.bookingCancelHours)) throw new BusinessError('O prazo para remarcar pelo app já passou. Fale com o lugar.');
      const [service, unit] = await Promise.all([
        booking.serviceId ? tx.service.findFirst({ where: { id: booking.serviceId, restaurantId: restaurant.id, active: true } }) : null,
        booking.unitId ? tx.unit.findFirst({ where: { id: booking.unitId, restaurantId: restaurant.id, active: true } }) : null,
      ]);
      if (!service || !unit) throw new BusinessError('Este serviço não está mais disponível para remarcar. Cancele e agende de novo.');
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) throw new BusinessError('Horário inválido.');

      const { slots, busy } = await slotsForDay(tx, { restaurantId: restaurant.id, policy: restaurant, service, unit, date: input.date, resourceId: input.resourceId || null, ignoreBookingId: booking.id, customerId });
      const slot = slots.find((s) => s.time === input.time);
      if (!slot) throw new SlotGoneError('Esse horário acabou de ser ocupado ou não está mais disponível. Escolha outro.');
      // Mantém o mesmo profissional quando ele está livre (a menos que o cliente tenha escolhido outro).
      const preferred = !input.resourceId && booking.resourceId && slot.resourceIds.includes(booking.resourceId) ? booking.resourceId : null;
      const resourceId = preferred ?? pickResource(slot.resourceIds, busy);
      if (!resourceId) throw new SlotGoneError('Esse horário não está mais disponível. Escolha outro.');
      if (resourceId === booking.resourceId && slot.startsAt.getTime() === booking.startsAt.getTime()) throw new BusinessError('Escolha um dia, horário ou profissional diferente do atual.');
      const durationMin = slot.durationByResource[resourceId] ?? service.durationMin;
      const endsAt = new Date(slot.startsAt.getTime() + durationMin * 60_000);
      const clash = await tx.booking.count({
        where: { id: { not: booking.id }, customerId, restaurantId: restaurant.id, status: { in: ['PENDING', 'CONFIRMED'] }, startsAt: { lt: endsAt }, endsAt: { gt: slot.startsAt } },
      });
      if (clash) throw new BusinessError('Você já tem um agendamento neste horário.');

      const auto = restaurant.bookingAutoConfirm;
      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: {
          startsAt: slot.startsAt,
          endsAt,
          resourceId,
          durationMin,
          status: auto ? 'CONFIRMED' : 'PENDING',
          confirmedAt: auto ? new Date() : null,
          reminderSentAt: null, // o lembrete de 30 min é do novo horário
          reminderAnswer: null,
        },
      });
      await notify(tx, {
        customerId,
        restaurantId: restaurant.id,
        title: auto ? 'Agendamento remarcado' : 'Pedido de remarcação enviado',
        body: `${booking.serviceName} · agora ${formatBookingWhen(slot.startsAt)} · ${restaurant.name}${auto ? '' : '. O lugar vai confirmar o novo horário.'}`,
        href: '/perfil/agendamentos',
      });
      return { booking: updated, before: { startsAt: booking.startsAt, resourceName: booking.resource?.name ?? null, resourceId: booking.resourceId } };
    },
    { timeout: 15_000 },
  );
  void notifyWaitlist(result.booking.restaurantId, dateKeyOf(result.before.startsAt)).catch((e) => console.error('Falha ao avisar a lista de espera', e instanceof Error ? e.message : e));
  void notifyStaffRescheduled(result.booking.id, result.before).catch((e) => console.error('Falha ao avisar a equipe da remarcação', e instanceof Error ? e.message : e));
  return result.booking;
}

/** E-mail à equipe: o cliente remarcou (mostra o horário antigo e o novo). */
export async function notifyStaffRescheduled(bookingId: string, before: { startsAt: Date; resourceName: string | null; resourceId: string | null }) {
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: { select: { name: true, phone: true } },
      resource: { select: { name: true, email: true } },
      unit: { select: { name: true } },
      restaurant: { select: { name: true, email: true, bookingNotifyEmail: true } },
    },
  });
  if (!b) return;
  const who = guestOf(b);
  const text = [
    `${who.name} remarcou um agendamento em ${b.restaurant.name}${b.status === 'PENDING' ? ' (aguardando a sua confirmação)' : ''}:`,
    '',
    `Serviço: ${b.serviceName} (${b.durationMin} min)`,
    `Antes: ${formatBookingWhen(before.startsAt)}${before.resourceName ? ` com ${before.resourceName}` : ''}`,
    `Agora: ${formatBookingWhen(b.startsAt)}${b.resource ? ` com ${b.resource.name}` : ''}`,
    `Cliente: ${who.name}${who.phone ? ` · ${formatPhone(who.phone)}` : ''}`,
    `Unidade: ${b.unit.name}`,
    '',
    `Veja a agenda: ${appUrl()}/dashboard/agenda`,
  ].join('\n');
  const old = before.resourceId && before.resourceId !== b.resourceId ? await prisma.resource.findUnique({ where: { id: before.resourceId }, select: { email: true } }) : null;
  const to = [...new Set([...staffAddresses(b), (old?.email ?? '').trim().toLowerCase()].filter(Boolean))];
  for (const address of to) await sendEmail({ to: address, subject: `Horário remarcado: ${b.serviceName} · ${formatBookingWhen(b.startsAt)}`, text });
}

/** E-mail ao profissional (se tiver e-mail) e ao e-mail padrão do estabelecimento a cada novo agendamento. */
export async function notifyStaff(bookingId: string) {
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: { select: { name: true, phone: true } },
      resource: { select: { name: true, email: true } },
      unit: { select: { name: true } },
      restaurant: { select: { name: true, email: true, bookingNotifyEmail: true } },
    },
  });
  if (!b) return;
  const to = staffAddresses(b);
  const who = guestOf(b);
  const when = formatBookingWhen(b.startsAt);
  const lines = [
    `Novo agendamento em ${b.restaurant.name}${b.status === 'PENDING' ? ' (aguardando a sua confirmação)' : ''}:`,
    '',
    `Serviço: ${b.serviceName} (${b.durationMin} min)`,
    `Quando: ${when}`,
    b.resource ? `Profissional: ${b.resource.name}` : null,
    `Cliente: ${who.name}${who.phone ? ` · ${formatPhone(who.phone)}` : ''}`,
    `Unidade: ${b.unit.name}`,
    b.partySize ? `Pessoas: ${b.partySize}` : null,
    b.discountCents > 0 ? `Desconto com pontos: ${formatBRL(b.discountCents)} (a cobrar ${formatBRL(b.priceCents - b.discountCents)})` : null,
    b.note ? `Recado: ${b.note}` : null,
    '',
    `Veja a agenda: ${appUrl()}/dashboard/agenda`,
  ].filter((l) => l !== null) as string[];
  for (const address of to) await sendEmail({ to: address, subject: `Novo agendamento: ${b.serviceName} · ${when}`, text: lines.join('\n') });
}

/** Cancela um agendamento em aberto; os pontos usados como desconto voltam para a carteira (uma única vez). */
export async function cancelBooking(id: string, by: 'CUSTOMER' | 'OWNER', where: { customerId?: string; restaurantId?: string }) {
  const booking = await cancelBookingTx(id, by, where);
  // O horário voltou para a agenda: quem estava esperando esse dia é avisado.
  void notifyWaitlist(booking.restaurantId, dateKeyOf(booking.startsAt)).catch((e) => console.error('Falha ao avisar a lista de espera', e instanceof Error ? e.message : e));
  return booking;
}

async function cancelBookingTx(id: string, by: 'CUSTOMER' | 'OWNER', where: { customerId?: string; restaurantId?: string }) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findFirst({ where: { id, ...where, status: { in: ['PENDING', 'CONFIRMED'] } } });
    if (!booking) throw new BusinessError('Agendamento não encontrado ou já encerrado.');
    const done = await tx.booking.updateMany({
      where: { id, status: { in: ['PENDING', 'CONFIRMED'] } },
      data: { status: 'CANCELED', canceledAt: new Date(), canceledBy: by },
    });
    if (done.count !== 1) throw new BusinessError('Agendamento não encontrado ou já encerrado.');
    if (booking.pointsUsed > 0 && booking.customerId) {
      const wallet = await tx.wallet.upsert({
        where: { customerId_restaurantId: { customerId: booking.customerId, restaurantId: booking.restaurantId } },
        create: { customerId: booking.customerId, restaurantId: booking.restaurantId, balance: booking.pointsUsed },
        update: { balance: { increment: booking.pointsUsed } },
      });
      await tx.transaction.create({ data: { walletId: wallet.id, type: 'EARN', points: booking.pointsUsed, description: `Pontos devolvidos: ${booking.serviceName} cancelado` } });
    }
    return booking;
  });
}

/**
 * O estabelecimento marca o atendimento como concluído: o agendamento fecha e os pontos entram na carteira do cliente,
 * tudo na mesma transação. Reaproveita o crédito do caixa (campanhas, indicação e desafios valem do mesmo jeito) e o
 * valor entra nas vendas do painel. Serviço sem preço conclui sem pontos.
 */
export async function completeBooking(id: string, restaurantId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findFirst({ where: { id, restaurantId, status: { in: ['PENDING', 'CONFIRMED'] } } });
    if (!booking) throw new BusinessError('Agendamento não encontrado ou já encerrado.');
    const restaurant = await tx.restaurant.findUnique({ where: { id: restaurantId }, select: { pointsPerReal: true } });
    if (!restaurant) throw new BusinessError('Estabelecimento não encontrado.');

    const marked = await tx.booking.updateMany({ where: { id, status: { in: ['PENDING', 'CONFIRMED'] } }, data: { status: 'COMPLETED', completedAt: new Date(), confirmedAt: booking.confirmedAt ?? new Date() } });
    if (marked.count !== 1) throw new BusinessError('Agendamento já encerrado.');

    // Os pontos ganhos contam sobre o que o cliente realmente pagou (preço menos o desconto em pontos).
    const paidCents = Math.max(0, booking.priceCents - booking.discountCents);
    const points = bookingPoints(paidCents, restaurant.pointsPerReal);
    if (paidCents <= 0 || points <= 0 || !booking.customerId) return { points: 0, booking };

    const token = newClaimToken();
    const claim = await tx.claim.create({
      data: {
        token,
        restaurantId,
        unitId: booking.unitId,
        amountCents: paidCents,
        points,
        billPoints: points,
        description: `Atendimento: ${booking.serviceName} (${formatBRL(paidCents)}${booking.discountCents > 0 ? `, com ${formatBRL(booking.discountCents)} de desconto em pontos` : ''})`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    const credited = await creditClaimWith(tx, token, booking.customerId);
    await tx.booking.update({ where: { id }, data: { claimId: claim.id, pointsAwarded: credited.points } });
    return { points: credited.points, booking };
  });
  // Atendimento concluído: convida o cliente a avaliar (depois de fechar a transação; se falhar, não atrapalha).
  if (result.booking) await askForReview({ id, customerId: result.booking.customerId, restaurantId, serviceName: result.booking.serviceName });
  return { points: result.points };
}

/** O estabelecimento confirma um pedido que estava aguardando. */
export async function confirmBooking(id: string, restaurantId: string) {
  const booking = await prisma.booking.findFirst({ where: { id, restaurantId, status: 'PENDING' }, include: { restaurant: { select: { name: true } } } });
  if (!booking) throw new BusinessError('Esse pedido não está mais aguardando confirmação.');
  const done = await prisma.booking.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'CONFIRMED', confirmedAt: new Date() } });
  if (done.count !== 1) throw new BusinessError('Esse pedido não está mais aguardando confirmação.');
  if (booking.customerId) await notify(prisma, {
    customerId: booking.customerId,
    restaurantId,
    title: 'Agendamento confirmado',
    body: `${booking.serviceName} · ${formatBookingWhen(booking.startsAt)} · ${booking.restaurant.name}`,
    href: '/perfil/agendamentos',
  });
}

export async function markNoShow(id: string, restaurantId: string) {
  const done = await prisma.booking.updateMany({ where: { id, restaurantId, status: { in: ['PENDING', 'CONFIRMED'] } }, data: { status: 'NO_SHOW' } });
  if (done.count !== 1) throw new BusinessError('Agendamento não encontrado ou já encerrado.');
}

/** Cancelamento pelo estabelecimento: avisa o cliente. */
export async function cancelByOwner(id: string, restaurantId: string) {
  const booking = await cancelBooking(id, 'OWNER', { restaurantId });
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { name: true } });
  if (booking.customerId) await notify(prisma, {
    customerId: booking.customerId,
    restaurantId,
    title: 'Agendamento cancelado pelo lugar',
    body: `${booking.serviceName} · ${formatBookingWhen(booking.startsAt)} · ${restaurant?.name ?? ''}.${booking.pointsUsed > 0 ? ` Seus ${booking.pointsUsed.toLocaleString('pt-BR')} pontos voltaram para a carteira.` : ''} Você pode marcar outro horário.`,
    href: `/lugar/${restaurantId}/agendar`,
  });
}

export const bookingTime = (b: { startsAt: Date }) => hmOf(b.startsAt);

/** Quem recebe os avisos de um agendamento: o profissional (se tiver e-mail) e o e-mail padrão do estabelecimento. */
const staffAddresses = (b: { resource: { email: string | null } | null; restaurant: { email: string; bookingNotifyEmail: string | null } }) =>
  [...new Set([b.resource?.email, b.restaurant.bookingNotifyEmail || b.restaurant.email].map((e) => (e ?? '').trim().toLowerCase()).filter(Boolean))];

/** Avisa a equipe que o cliente liberou o horário ao responder "não" ao lembrete. */
export async function notifyStaffFreed(bookingId: string) {
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: { select: { name: true, phone: true } }, resource: { select: { name: true, email: true } }, restaurant: { select: { name: true, email: true, bookingNotifyEmail: true } } },
  });
  if (!b) return;
  const who = guestOf(b);
  const when = formatBookingWhen(b.startsAt);
  const text = [
    `${who.name} avisou que não vai poder comparecer. O horário foi liberado:`,
    '',
    `Serviço: ${b.serviceName}`,
    `Quando: ${when}`,
    b.resource ? `Profissional: ${b.resource.name}` : null,
    `Cliente: ${who.name}${who.phone ? ` · ${formatPhone(who.phone)}` : ''}`,
    '',
    `Veja a agenda: ${appUrl()}/dashboard/agenda`,
  ].filter((l) => l !== null).join('\n');
  for (const address of staffAddresses(b)) await sendEmail({ to: address, subject: `Horário liberado: ${b.serviceName} · ${when}`, text });
}

/**
 * Envia o "está tudo certo?" aos agendamentos confirmados que entraram na janela de ~30 min.
 * Roda de tempos em tempos (GitHub Actions → /api/cron/lembretes). Cada agendamento é "reservado" antes do envio,
 * então execuções simultâneas não mandam duas vezes.
 */
export async function sendDueReminders(now: Date = new Date()) {
  const rows = await prisma.booking.findMany({
    where: {
      status: 'CONFIRMED',
      reminderSentAt: null,
      customerId: { not: null },
      startsAt: { gte: new Date(now.getTime() + REMINDER_MIN_AHEAD_MIN * 60_000), lte: new Date(now.getTime() + REMINDER_LEAD_MIN * 60_000) },
    },
    include: { customer: { select: { id: true, name: true, email: true } }, restaurant: { select: { name: true } }, resource: { select: { name: true } } },
    take: 200,
  });
  let sent = 0;
  for (const b of rows) {
    if (!reminderDue(b, now) || !b.customer || !b.customerId) continue;
    const claimed = await prisma.booking.updateMany({ where: { id: b.id, status: 'CONFIRMED', reminderSentAt: null }, data: { reminderSentAt: now } });
    if (claimed.count !== 1) continue;
    const time = hmOf(b.startsAt).replace(/^0/, '').replace(':00', 'h').replace(':', 'h');
    const what = `${b.serviceName} às ${time}${b.resource ? ` com ${b.resource.name}` : ''} em ${b.restaurant.name}`;
    try {
      await notify(prisma, {
        customerId: b.customerId,
        restaurantId: b.restaurantId,
        title: 'Está tudo certo para o seu horário?',
        body: `${what}. Toque para confirmar que vai ou liberar o horário.`,
        href: `/perfil/agendamentos?lembrete=${b.id}`,
      });
    } catch (e) {
      console.error('[lembretes] aviso não gravado; será tentado de novo', b.id, e);
      await prisma.booking.updateMany({ where: { id: b.id, reminderAnswer: null }, data: { reminderSentAt: null } });
      continue;
    }
    sent++;
    const to = (b.customer.email ?? '').trim();
    if (to) {
      await sendEmail({
        to,
        subject: `Está tudo certo? ${b.serviceName} às ${time}`,
        text: [`Olá, ${b.customer.name.split(' ')[0]}!`, '', `Seu horário está chegando: ${what}.`, '', `Está tudo certo? Confirme que vai, ou libere o horário se não puder ir:`, `${appUrl()}/perfil/agendamentos?lembrete=${b.id}`].join('\n'),
      }).catch((e) => console.error('[lembretes] e-mail não enviado', b.id, e));
    }
  }
  return { checked: rows.length, sent };
}

/** O cliente responde ao lembrete: "sim" confirma presença; "não" cancela e libera o horário (os pontos usados voltam). */
export async function answerReminder(id: string, customerId: string, answer: 'yes' | 'no', now: Date = new Date()) {
  const b = await prisma.booking.findFirst({ where: { id, customerId, status: { in: ['PENDING', 'CONFIRMED'] }, reminderSentAt: { not: null } } });
  if (!b) throw new BusinessError('Este lembrete não está mais disponível.');
  if (b.reminderAnswer) throw new BusinessError('Você já respondeu a este lembrete.');
  if (b.endsAt <= now) throw new BusinessError('Este horário já passou.');
  if (answer === 'yes') {
    const r = await prisma.booking.updateMany({ where: { id, reminderAnswer: null }, data: { reminderAnswer: 'OK', reminderAnsweredAt: now } });
    if (r.count !== 1) throw new BusinessError('Você já respondeu a este lembrete.');
    return { canceled: false };
  }
  await cancelBooking(id, 'CUSTOMER', { customerId });
  await prisma.booking.update({ where: { id }, data: { reminderAnswer: 'NO', reminderAnsweredAt: now } });
  notifyStaffFreed(id).catch((e) => console.error('[lembretes] aviso à equipe falhou', id, e));
  return { canceled: true };
}

/** Quantos pedidos de espera um cliente pode ter em aberto num mesmo lugar. */
export const MAX_WAITING_PER_PLACE = 5;
/** Quantas pessoas da fila são avisadas a cada vez que um horário abre (as mais antigas primeiro). */
const WAIT_NOTIFY_MAX = 3;
/** Quem acabou de ser avisado só é avisado de novo depois deste tempo (se ainda não marcou). */
const WAIT_RENOTIFY_MS = 30 * 60_000;

export type WaitInput = { restaurantId: string; serviceId: string; unitId: string; date: string; period: string; resourceId?: string | null };

/**
 * O cliente entra na lista de espera de um dia sem horário na faixa escolhida (manhã, tarde, noite ou qualquer uma).
 * Só vale para dia que o lugar atende e que ainda não tem horário livre nessa faixa; senão ele marca direto.
 * Entrar de novo no mesmo serviço e dia reaproveita o pedido (quem saiu da fila volta para o fim).
 */
export async function joinWaitlist(customerId: string, input: WaitInput) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.restaurantId}))`;
      const restaurant = await tx.restaurant.findUnique({ where: { id: input.restaurantId } });
      if (!restaurant || restaurant.subscriptionStatus !== 'ACTIVE' || !restaurant.onboardedAt) throw new BusinessError('Este lugar não está recebendo agendamentos agora.');
      const [service, unit] = await Promise.all([
        tx.service.findFirst({ where: { id: input.serviceId, restaurantId: restaurant.id, active: true } }),
        tx.unit.findFirst({ where: { id: input.unitId, restaurantId: restaurant.id, active: true } }),
      ]);
      if (!service) throw new BusinessError('Este serviço não está mais disponível.');
      if (!unit) throw new BusinessError('Unidade não encontrada.');
      if (!isWaitPeriod(input.period)) throw new BusinessError('Escolha a faixa de horário.');
      const today = todayKey();
      if (!parseDateKey(input.date) || input.date < today || input.date > addDaysKey(today, restaurant.bookingMaxDaysAhead)) throw new BusinessError('Escolha um dia dentro do prazo de agendamento.');

      const resourceId = input.resourceId || null;
      const staff = await staffFor(tx, { restaurantId: restaurant.id, service, unitId: unit.id, resourceId });
      if (staff.length === 0) throw new BusinessError('Esse profissional não atende este serviço.');
      const open = dayOccupancy({ date: input.date, schedule: parseSchedule(unit.openingSchedule), resources: staff, bookings: [], timeOffs: [] });
      if (open.capacityMin <= 0) throw new BusinessError('O lugar não atende nesse dia.');
      const { slots } = await slotsForDay(tx, { restaurantId: restaurant.id, policy: restaurant, service, unit, date: input.date, resourceId, customerId });
      if (slots.some((s) => inPeriod(s.time, input.period))) throw new BusinessError('Ainda há horário livre nessa faixa. Escolha direto na lista de horários.');

      const key = { customerId_restaurantId_serviceId_date: { customerId, restaurantId: restaurant.id, serviceId: service.id, date: input.date } };
      const existing = await tx.waitlistEntry.findUnique({ where: key });
      if (!existing || existing.status !== 'WAITING') {
        const waiting = await tx.waitlistEntry.count({ where: { customerId, restaurantId: restaurant.id, status: 'WAITING', date: { gte: today } } });
        if (waiting >= MAX_WAITING_PER_PLACE) throw new BusinessError(`Você já está em ${MAX_WAITING_PER_PLACE} listas de espera neste lugar. Saia de alguma para entrar em outra.`);
      }
      const data = { unitId: unit.id, resourceId, period: input.period };
      const entry = existing
        ? await tx.waitlistEntry.update({ where: key, data: existing.status === 'WAITING' ? data : { ...data, status: 'WAITING', notifiedAt: null, createdAt: new Date() } })
        : await tx.waitlistEntry.create({ data: { ...data, restaurantId: restaurant.id, customerId, serviceId: service.id, date: input.date } });
      return entry;
    },
    { timeout: 15_000 },
  );
}

/** O cliente sai da fila. */
export async function leaveWaitlist(customerId: string, entryId: string) {
  const done = await prisma.waitlistEntry.updateMany({ where: { id: entryId, customerId, status: 'WAITING' }, data: { status: 'CANCELED' } });
  if (done.count !== 1) throw new BusinessError('Esse pedido de espera não está mais ativo.');
}

/** Posição na fila (1 = o mais antigo) entre quem espera o mesmo serviço no mesmo dia. */
export async function waitPosition(entry: { restaurantId: string; serviceId: string; date: string; createdAt: Date }) {
  const ahead = await prisma.waitlistEntry.count({ where: { restaurantId: entry.restaurantId, serviceId: entry.serviceId, date: entry.date, status: 'WAITING', createdAt: { lt: entry.createdAt } } });
  return ahead + 1;
}

/**
 * Um horário abriu neste dia: avisa os primeiros da fila (por ordem de chegada) que agora têm horário na faixa que pediram.
 * "Quem chegar primeiro marca primeiro": o aviso não reserva nada, só chama; a reserva de 5 minutos e o cadeado seguem valendo.
 * Quem foi avisado há pouco espera um tempo antes de ser avisado de novo. Devolve quantos avisos saíram.
 */
export async function notifyWaitlist(restaurantId: string, date: string, now: Date = new Date()): Promise<number> {
  if (date < todayKey(now)) return 0;
  const cutoff = new Date(now.getTime() - WAIT_RENOTIFY_MS);
  const queue = await prisma.waitlistEntry.findMany({
    where: { restaurantId, date, status: 'WAITING', OR: [{ notifiedAt: null }, { notifiedAt: { lt: cutoff } }] },
    orderBy: { createdAt: 'asc' },
    include: { restaurant: true, service: true, unit: true },
  });
  let sent = 0;
  for (const e of queue) {
    if (sent >= WAIT_NOTIFY_MAX) break;
    if (!e.service.active || !e.unit.active || e.restaurant.subscriptionStatus !== 'ACTIVE') continue;
    const { slots } = await slotsForDay(prisma, { restaurantId, policy: e.restaurant, service: e.service, unit: e.unit, date, now, resourceId: e.resourceId, customerId: e.customerId });
    const fits = slots.filter((s) => inPeriod(s.time, e.period));
    if (fits.length === 0) continue;
    // Marca antes de avisar: duas execuções ao mesmo tempo não mandam o mesmo aviso duas vezes.
    const claimed = await prisma.waitlistEntry.updateMany({ where: { id: e.id, status: 'WAITING', OR: [{ notifiedAt: null }, { notifiedAt: { lt: cutoff } }] }, data: { notifiedAt: now } });
    if (claimed.count !== 1) continue;
    const q = new URLSearchParams({ servico: e.serviceId, unidade: e.unitId, data: date, hora: fits[0].time });
    if (e.resourceId) q.set('prof', e.resourceId);
    const times = fits.slice(0, 3).map((s) => s.time).join(', ');
    await notify(prisma, {
      customerId: e.customerId,
      restaurantId,
      title: 'Abriu um horário que você queria',
      body: `${e.service.name} · ${formatBookingWhen(fits[0].startsAt).split(' às ')[0]} · ${e.restaurant.name}: ${times}. Quem confirmar primeiro fica com o horário.`,
      href: `/lugar/${restaurantId}/agendar?${q.toString()}`,
    });
    sent++;
  }
  return sent;
}
