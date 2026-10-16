import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from './db';
import { BusinessError, creditClaimWith } from './claims';
import { REMINDER_LEAD_MIN, REMINDER_MIN_AHEAD_MIN, availableSlots, bookingPoints, dayStartUtc, formatBookingWhen, hmOf, parseDateKey, pickResource, reminderDue, type BusyRange, type Slot } from './booking';
import { suggestsBooking } from './categories';
import { parseSchedule } from './hours';
import { sendEmail } from './mailer';
import { notify } from './notifications';
import { applyPoints } from './points-discount';
import { appUrl } from './payments';
import { formatBRL } from './points';
import { formatPhone } from './br';
import { newClaimToken } from './tokens';

type Db = Prisma.TransactionClient | typeof prisma;
const DAY_MS = 24 * 60 * 60 * 1000;

type Policy = { bookingMinNoticeMin: number; bookingMaxDaysAhead: number };
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
  args: { restaurantId: string; policy: Policy; service: ServiceLike; unit: { id: string; openingSchedule: unknown }; date: string; now?: Date; resourceId?: string | null },
): Promise<{ slots: Slot[]; busy: BusyRange[] }> {
  const { restaurantId, policy, service, unit, date } = args;
  if (!parseDateKey(date)) return { slots: [], busy: [] };
  const staff = await staffFor(db, { restaurantId, service, unitId: unit.id, resourceId: args.resourceId });
  if (staff.length === 0) return { slots: [], busy: [] };
  const start = dayStartUtc(date);
  const busy = await db.booking.findMany({
    where: {
      resourceId: { in: staff.map((r) => r.id) },
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
    resources: staff.map((r) => ({ id: r.id, capacity: r.capacity, durationMin: r.durationMin, schedule: r.schedule })),
    busy,
    now: args.now ?? new Date(),
    minNoticeMin: policy.bookingMinNoticeMin,
    maxDaysAhead: policy.bookingMaxDaysAhead,
  });
  return { slots, busy };
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

      const { slots, busy } = await slotsForDay(tx, { restaurantId: restaurant.id, policy: restaurant, service, unit, date: input.date, resourceId: input.resourceId || null });
      const slot = slots.find((s) => s.time === input.time);
      if (!slot) throw new BusinessError('Esse horário acabou de ser ocupado ou não está mais disponível. Escolha outro.');
      const resourceId = pickResource(slot.resourceIds, busy);
      if (!resourceId) throw new BusinessError('Esse horário não está mais disponível. Escolha outro.');
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
  const when = formatBookingWhen(b.startsAt);
  const lines = [
    `Novo agendamento em ${b.restaurant.name}${b.status === 'PENDING' ? ' (aguardando a sua confirmação)' : ''}:`,
    '',
    `Serviço: ${b.serviceName} (${b.durationMin} min)`,
    `Quando: ${when}`,
    b.resource ? `Profissional: ${b.resource.name}` : null,
    `Cliente: ${b.customer.name} · ${formatPhone(b.customer.phone)}`,
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
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findFirst({ where: { id, ...where, status: { in: ['PENDING', 'CONFIRMED'] } } });
    if (!booking) throw new BusinessError('Agendamento não encontrado ou já encerrado.');
    const done = await tx.booking.updateMany({
      where: { id, status: { in: ['PENDING', 'CONFIRMED'] } },
      data: { status: 'CANCELED', canceledAt: new Date(), canceledBy: by },
    });
    if (done.count !== 1) throw new BusinessError('Agendamento não encontrado ou já encerrado.');
    if (booking.pointsUsed > 0) {
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
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findFirst({ where: { id, restaurantId, status: { in: ['PENDING', 'CONFIRMED'] } } });
    if (!booking) throw new BusinessError('Agendamento não encontrado ou já encerrado.');
    const restaurant = await tx.restaurant.findUnique({ where: { id: restaurantId }, select: { pointsPerReal: true } });
    if (!restaurant) throw new BusinessError('Estabelecimento não encontrado.');

    const marked = await tx.booking.updateMany({ where: { id, status: { in: ['PENDING', 'CONFIRMED'] } }, data: { status: 'COMPLETED', completedAt: new Date(), confirmedAt: booking.confirmedAt ?? new Date() } });
    if (marked.count !== 1) throw new BusinessError('Agendamento já encerrado.');

    // Os pontos ganhos contam sobre o que o cliente realmente pagou (preço menos o desconto em pontos).
    const paidCents = Math.max(0, booking.priceCents - booking.discountCents);
    const points = bookingPoints(paidCents, restaurant.pointsPerReal);
    if (paidCents <= 0 || points <= 0) return { points: 0 };

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
    return { points: credited.points };
  });
}

/** O estabelecimento confirma um pedido que estava aguardando. */
export async function confirmBooking(id: string, restaurantId: string) {
  const booking = await prisma.booking.findFirst({ where: { id, restaurantId, status: 'PENDING' }, include: { restaurant: { select: { name: true } } } });
  if (!booking) throw new BusinessError('Esse pedido não está mais aguardando confirmação.');
  const done = await prisma.booking.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'CONFIRMED', confirmedAt: new Date() } });
  if (done.count !== 1) throw new BusinessError('Esse pedido não está mais aguardando confirmação.');
  await notify(prisma, {
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
  await notify(prisma, {
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
  const when = formatBookingWhen(b.startsAt);
  const text = [
    `${b.customer.name} avisou que não vai poder comparecer. O horário foi liberado:`,
    '',
    `Serviço: ${b.serviceName}`,
    `Quando: ${when}`,
    b.resource ? `Profissional: ${b.resource.name}` : null,
    `Cliente: ${b.customer.name} · ${formatPhone(b.customer.phone)}`,
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
      startsAt: { gte: new Date(now.getTime() + REMINDER_MIN_AHEAD_MIN * 60_000), lte: new Date(now.getTime() + REMINDER_LEAD_MIN * 60_000) },
    },
    include: { customer: { select: { id: true, name: true, email: true } }, restaurant: { select: { name: true } }, resource: { select: { name: true } } },
    take: 200,
  });
  let sent = 0;
  for (const b of rows) {
    if (!reminderDue(b, now)) continue;
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
