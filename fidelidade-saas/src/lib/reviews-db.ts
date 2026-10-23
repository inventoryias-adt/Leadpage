import 'server-only';
import { prisma } from './db';
import { BusinessError } from './claims';
import { notify } from './notifications';
import { REVIEW_WINDOW_DAYS, cleanText, parseRating, reviewWindowOpen, summarize, type RatingSummary } from './reviews';

/** O cliente avalia um atendimento concluído dele: nota do lugar, nota de quem atendeu (se houve profissional) e comentário. Uma vez só. */
export async function submitReview(customerId: string, bookingId: string, input: { placeRating: unknown; staffRating?: unknown; comment?: unknown }) {
  const placeRating = parseRating(input.placeRating);
  if (!placeRating) throw new BusinessError('Escolha de 1 a 5 estrelas para o lugar.');
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, customerId },
    select: { id: true, restaurantId: true, resourceId: true, status: true, completedAt: true, review: { select: { id: true } } },
  });
  if (!booking || booking.status !== 'COMPLETED') throw new BusinessError('Só dá para avaliar um atendimento concluído.');
  if (booking.review) throw new BusinessError('Você já avaliou este atendimento.');
  if (!reviewWindowOpen(booking.completedAt)) throw new BusinessError(`O prazo para avaliar (${REVIEW_WINDOW_DAYS} dias depois do atendimento) já passou.`);
  let staffRating: number | null = null;
  if (booking.resourceId && input.staffRating !== undefined && input.staffRating !== null && input.staffRating !== '') {
    staffRating = parseRating(input.staffRating);
    if (!staffRating) throw new BusinessError('A nota de quem atendeu vai de 1 a 5 estrelas.');
  }
  try {
    return await prisma.review.create({
      data: {
        restaurantId: booking.restaurantId,
        customerId,
        bookingId: booking.id,
        resourceId: booking.resourceId,
        placeRating,
        staffRating,
        comment: cleanText(input.comment),
      },
    });
  } catch (e) {
    // duas abas ao mesmo tempo: a segunda bate no índice único do agendamento
    if ((e as { code?: string })?.code === 'P2002') throw new BusinessError('Você já avaliou este atendimento.');
    throw e;
  }
}

/** Avisa o cliente de que o atendimento foi concluído e que dá para avaliar (melhor esforço: não atrapalha a conclusão). */
export async function askForReview(booking: { id: string; customerId: string | null; restaurantId: string; serviceName: string }) {
  if (!booking.customerId) return;
  try {
    const restaurant = await prisma.restaurant.findUnique({ where: { id: booking.restaurantId }, select: { name: true } });
    await notify(prisma, {
      customerId: booking.customerId,
      restaurantId: booking.restaurantId,
      title: 'Como foi o atendimento?',
      body: `${booking.serviceName} · ${restaurant?.name ?? 'seu lugar'}. Conte em 1 minuto: sua nota ajuda os outros clientes.`,
      href: `/perfil/agendamentos/${booking.id}/avaliar`,
    });
  } catch (e) {
    console.error('aviso de avaliação falhou', e);
  }
}

const visible = { hiddenAt: null } as const;

/** Média e quantidade por lugar (só avaliações não ocultadas). */
export async function placeSummaries(restaurantIds: string[]): Promise<Map<string, RatingSummary>> {
  const out = new Map<string, RatingSummary>();
  if (!restaurantIds.length) return out;
  const rows = await prisma.review.findMany({ where: { restaurantId: { in: restaurantIds }, ...visible }, select: { restaurantId: true, placeRating: true } });
  const by = new Map<string, number[]>();
  for (const r of rows) by.set(r.restaurantId, [...(by.get(r.restaurantId) ?? []), r.placeRating]);
  for (const id of restaurantIds) out.set(id, summarize(by.get(id) ?? []));
  return out;
}

/** Média e quantidade por profissional (nota de quem atendeu). */
export async function staffSummaries(resourceIds: string[]): Promise<Map<string, RatingSummary>> {
  const out = new Map<string, RatingSummary>();
  if (!resourceIds.length) return out;
  const rows = await prisma.review.findMany({ where: { resourceId: { in: resourceIds }, staffRating: { not: null }, ...visible }, select: { resourceId: true, staffRating: true } });
  const by = new Map<string, number[]>();
  for (const r of rows) if (r.resourceId && r.staffRating) by.set(r.resourceId, [...(by.get(r.resourceId) ?? []), r.staffRating]);
  for (const id of resourceIds) out.set(id, summarize(by.get(id) ?? []));
  return out;
}

/** Avaliações do lugar para a página dele (as mais recentes primeiro, sem as ocultadas). */
export async function placeReviews(restaurantId: string, take = 10) {
  return prisma.review.findMany({
    where: { restaurantId, ...visible },
    orderBy: { createdAt: 'desc' },
    take,
    select: { id: true, placeRating: true, staffRating: true, comment: true, ownerReply: true, createdAt: true, customer: { select: { name: true } }, resource: { select: { name: true } } },
  });
}

/** O dono responde uma avaliação do lugar dele (uma resposta; responder de novo substitui). */
export async function replyToReview(restaurantId: string, reviewId: string, text: unknown) {
  const reply = cleanText(text);
  if (!reply) throw new BusinessError('Escreva a resposta.');
  const done = await prisma.review.updateMany({ where: { id: reviewId, restaurantId }, data: { ownerReply: reply, ownerRepliedAt: new Date() } });
  if (done.count !== 1) throw new BusinessError('Avaliação não encontrada.');
}

/** O dono denuncia uma avaliação (ofensa, golpe, não foi cliente…). Ela continua visível até a administração decidir. */
export async function reportReview(restaurantId: string, reviewId: string, reason: unknown) {
  const why = cleanText(reason, 300);
  if (!why) throw new BusinessError('Conte rapidamente o motivo da denúncia.');
  const done = await prisma.review.updateMany({ where: { id: reviewId, restaurantId, reportedAt: null }, data: { reportedAt: new Date(), reportReason: why } });
  if (done.count !== 1) throw new BusinessError('Avaliação não encontrada ou já denunciada.');
}

/** Administração: oculta (some do app e da nota) ou mantém (encerra a denúncia). */
export async function moderateReview(reviewId: string, action: 'hide' | 'keep') {
  const done = await prisma.review.updateMany({
    where: { id: reviewId, reportedAt: { not: null } },
    data: action === 'hide' ? { hiddenAt: new Date() } : { reportedAt: null, reportReason: null },
  });
  if (done.count !== 1) throw new BusinessError('Avaliação não encontrada ou sem denúncia.');
}

export type ReviewPrompt = { bookingId: string; serviceName: string; placeName: string };

/** O atendimento concluído mais recente (até 3 dias) que o cliente ainda não avaliou: vira um convite na tela do app. */
export async function reviewPrompt(customerId: string): Promise<ReviewPrompt | null> {
  const b = await prisma.booking.findFirst({
    where: { customerId, status: 'COMPLETED', review: null, completedAt: { gte: new Date(Date.now() - 3 * 24 * 3600e3) } },
    orderBy: { completedAt: 'desc' },
    select: { id: true, serviceName: true, restaurant: { select: { name: true } } },
  });
  return b ? { bookingId: b.id, serviceName: b.serviceName, placeName: b.restaurant.name } : null;
}
