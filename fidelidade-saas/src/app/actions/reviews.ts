'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { logAdmin } from '@/lib/admin';
import { BusinessError } from '@/lib/claims';
import { prisma } from '@/lib/db';
import { fail, type FormState } from '@/lib/form';
import { TOO_MANY, allow } from '@/lib/rate-limit';
import { moderateReview, replyToReview, reportReview, submitReview } from '@/lib/reviews-db';
import { getCustomer, requireActiveRestaurant, requireAdmin } from '@/lib/session';

const ID = /^[0-9a-f-]{36}$/;

/** O cliente envia a avaliação de um atendimento concluído. */
export async function submitReviewAction(_: FormState, formData: FormData): Promise<FormState> {
  const customer = await getCustomer();
  if (!customer) return { error: 'Sua sessão expirou. Entre novamente para avaliar.' };
  const bookingId = String(formData.get('bookingId') ?? '');
  if (!ID.test(bookingId)) return fail('Atendimento inválido.', formData);
  if (!(await allow(`review:${customer.id}`, 20, 3600))) return fail(TOO_MANY, formData);
  try {
    await submitReview(customer.id, bookingId, {
      placeRating: formData.get('placeRating'),
      staffRating: formData.get('staffRating'),
      comment: formData.get('comment'),
    });
  } catch (e) {
    if (e instanceof BusinessError) return fail(e.message, formData);
    throw e;
  }
  revalidatePath('/perfil/agendamentos');
  revalidatePath('/lugares');
  redirect('/perfil/agendamentos?avaliado=1');
}

const back = (notice?: string) => `/dashboard/avaliacoes${notice ? `?${notice}` : ''}`;

/** O dono responde uma avaliação do lugar dele. */
export async function replyReviewAction(formData: FormData) {
  const restaurant = await requireActiveRestaurant();
  const id = String(formData.get('id') ?? '');
  let notice = '';
  try {
    if (!ID.test(id)) throw new BusinessError('Avaliação não encontrada.');
    await replyToReview(restaurant.id, id, formData.get('reply'));
    notice = 'ok=Resposta publicada.';
  } catch (e) {
    if (!(e instanceof BusinessError)) throw e;
    notice = `erro=${encodeURIComponent(e.message)}`;
  }
  revalidatePath('/dashboard/avaliacoes');
  revalidatePath(`/lugar/${restaurant.id}`);
  redirect(back(notice));
}

/** O dono denuncia uma avaliação; a administração decide se oculta. */
export async function reportReviewAction(formData: FormData) {
  const restaurant = await requireActiveRestaurant();
  const id = String(formData.get('id') ?? '');
  let notice = '';
  try {
    if (!ID.test(id)) throw new BusinessError('Avaliação não encontrada.');
    await reportReview(restaurant.id, id, formData.get('reason'));
    notice = 'ok=Denúncia enviada. A administração vai analisar.';
  } catch (e) {
    if (!(e instanceof BusinessError)) throw e;
    notice = `erro=${encodeURIComponent(e.message)}`;
  }
  revalidatePath('/dashboard/avaliacoes');
  redirect(back(notice));
}

/** Administração: oculta ou mantém uma avaliação denunciada. */
export async function adminModerateReview(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get('id') ?? '');
  const op = formData.get('op') === 'hide' ? 'hide' : 'keep';
  if (!ID.test(id)) redirect('/admin/avaliacoes');
  const review = await prisma.review.findUnique({ where: { id }, select: { restaurant: { select: { id: true, name: true } }, placeRating: true } });
  try {
    await moderateReview(id, op);
  } catch (e) {
    if (!(e instanceof BusinessError)) throw e;
  }
  if (review) await logAdmin(admin, op === 'hide' ? 'ocultar avaliação' : 'manter avaliação', `Avaliação de ${review.placeRating} estrela(s) ${op === 'hide' ? 'ocultada' : 'mantida'} após denúncia.`, review.restaurant);
  revalidatePath('/admin', 'layout');
  if (review) revalidatePath(`/lugar/${review.restaurant.id}`);
  redirect('/admin/avaliacoes');
}
