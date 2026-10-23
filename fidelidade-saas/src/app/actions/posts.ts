'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { BusinessError } from '@/lib/claims';
import { prisma } from '@/lib/db';
import { fail, type FormState } from '@/lib/form';
import { parseInstagram } from '@/lib/posts';
import { createPost, deletePost, moderatePost, reportPost, reportPostAsOwner, toggleLike } from '@/lib/posts-db';
import { TOO_MANY, allow } from '@/lib/rate-limit';
import { logAdmin } from '@/lib/admin';
import { getCustomer, getRestaurant, requireAdmin } from '@/lib/session';

/** Publica a indicação (a foto chega reduzida pelo navegador, em `photoData`). Dá certo → feed com o aviso. */
export async function publishPost(_: FormState, formData: FormData): Promise<FormState> {
  const customer = await getCustomer();
  if (!customer) return fail('Entre na sua conta para indicar um lugar.', formData);
  if (!(await allow(`post:${customer.id}`, 20, 3600))) return fail(TOO_MANY, formData);
  let id: string;
  try {
    const post = await createPost(customer.id, { restaurantId: formData.get('restaurantId'), rating: formData.get('rating'), comment: formData.get('comment') }, String(formData.get('photoData') ?? ''));
    id = post.id;
  } catch (e) {
    if (e instanceof BusinessError) return fail(e.message, formData);
    throw e;
  }
  revalidatePath('/indicacoes');
  revalidatePath('/carteira');
  redirect(`/indicacoes?publicada=${id}`);
}

export type LikeState = { liked: boolean; likes: number } | { error: string };

export async function likePost(postId: string): Promise<LikeState> {
  const customer = await getCustomer();
  if (!customer) return { error: 'Entre na sua conta para curtir.' };
  if (!(await allow(`like:${customer.id}`, 200, 3600))) return { error: TOO_MANY };
  try {
    return await toggleLike(customer.id, postId);
  } catch (e) {
    if (e instanceof BusinessError) return { error: e.message };
    throw e;
  }
}

export async function reportPostAction(postId: string, reason: string): Promise<{ ok: true } | { error: string }> {
  const customer = await getCustomer();
  if (!customer) return { error: 'Entre na sua conta para denunciar.' };
  if (!(await allow(`report:${customer.id}`, 20, 3600))) return { error: TOO_MANY };
  try {
    await reportPost(customer.id, postId, reason);
    return { ok: true };
  } catch (e) {
    if (e instanceof BusinessError) return { error: e.message };
    throw e;
  }
}

export async function removePost(postId: string): Promise<void> {
  const customer = await getCustomer();
  if (!customer) return;
  await deletePost(customer.id, postId);
  revalidatePath('/indicacoes');
}

/** Salva (ou apaga, com o campo vazio) o @ do Instagram do cliente. */
export async function saveInstagram(_: FormState, formData: FormData): Promise<FormState> {
  const customer = await getCustomer();
  if (!customer) return { error: 'Entre na sua conta.' };
  const handle = parseInstagram(formData.get('instagram'));
  if (handle === null) return fail('Use só o seu @ do Instagram: letras, números, ponto e sublinhado.', formData);
  await prisma.customer.update({ where: { id: customer.id }, data: { instagram: handle || null } });
  revalidatePath('/perfil');
  revalidatePath('/indicacoes');
  return { ok: handle ? 'Instagram salvo.' : 'Instagram removido.' };
}

const ID = /^[0-9a-f-]{36}$/;

/** Dono do lugar: denuncia uma indicação que cita o lugar dele (a administração decide). */
export async function ownerReportPost(postId: string, reason: string): Promise<{ ok: true } | { error: string }> {
  const owner = await getRestaurant();
  if (!owner) return { error: 'Entre na sua conta.' };
  if (!(await allow(`oreport:${owner.id}`, 30, 3600))) return { error: TOO_MANY };
  try {
    await reportPostAsOwner(owner.id, postId, reason);
    return { ok: true };
  } catch (e) {
    if (e instanceof BusinessError) return { error: e.message };
    throw e;
  }
}

/** Administração: esconde ou mantém uma indicação denunciada. */
export async function adminModeratePost(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get('id') ?? '');
  const op = formData.get('op') === 'hide' ? 'hide' : 'keep';
  if (!ID.test(id)) redirect('/admin/indicacoes');
  const post = await prisma.post.findUnique({ where: { id }, select: { restaurant: { select: { id: true, name: true } }, rating: true } });
  try {
    await moderatePost(id, op);
  } catch (e) {
    if (!(e instanceof BusinessError)) throw e;
  }
  if (post) await logAdmin(admin, op === 'hide' ? 'ocultar indicação' : 'manter indicação', `Indicação de ${post.rating} estrela(s) ${op === 'hide' ? 'ocultada' : 'mantida'} após denúncia.`, post.restaurant);
  revalidatePath('/admin', 'layout');
  revalidatePath('/indicacoes');
  redirect('/admin/indicacoes');
}
