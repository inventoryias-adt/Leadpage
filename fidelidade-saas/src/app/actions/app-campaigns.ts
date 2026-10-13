'use server';

import { revalidatePath } from 'next/cache';
import { logAdmin } from '@/lib/admin';
import { joinCampaign, leaveCampaign, syncCampaign } from '@/lib/app-campaigns-db';
import { validateCampaign } from '@/lib/app-campaigns';
import { parseMoneyToCents } from '@/lib/points';
import { BusinessError } from '@/lib/claims';
import { prisma } from '@/lib/db';
import { fail, type FormState } from '@/lib/form';
import { endOfDayBR, parseTime, startOfDayBR } from '@/lib/promos';
import { requireAdmin, requirePaidRestaurant } from '@/lib/session';

// ---------------------------------------------------------------- Administração

/** Cria ou edita uma campanha do app. As promoções dos estabelecimentos que já adotaram acompanham a edição. */
export async function adminSaveAppCampaign(_: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const kind = formData.get('kind') === 'BONUS' ? 'BONUS' : 'MULTIPLIER';
  const checked = validateCampaign(
    {
      title: String(formData.get('title') ?? ''),
      description: String(formData.get('description') ?? ''),
      kind,
      multiplier: String(formData.get('multiplier') ?? ''),
      bonusPoints: String(formData.get('bonusPoints') ?? ''),
      minAmount: String(formData.get('minAmount') ?? ''),
      weekdays: formData.getAll('weekdays').map(Number),
      startTime: String(formData.get('startTime') ?? ''),
      endTime: String(formData.get('endTime') ?? ''),
      startDate: String(formData.get('startDate') ?? ''),
      endDate: String(formData.get('endDate') ?? ''),
    },
    parseMoneyToCents,
    startOfDayBR,
    endOfDayBR,
    parseTime,
  );
  if (!checked.ok) return fail(checked.error, formData);

  const id = String(formData.get('id') ?? '');
  if (id) {
    const found = await prisma.appCampaign.findUnique({ where: { id }, select: { id: true } });
    if (!found) return fail('Campanha não encontrada.', formData);
    await prisma.appCampaign.update({ where: { id }, data: checked.data });
    await syncCampaign(id);
    await logAdmin(admin, 'campanha', `Campanha do app editada: ${checked.data.title}`);
  } else {
    await prisma.appCampaign.create({ data: checked.data });
    await logAdmin(admin, 'campanha', `Campanha do app criada: ${checked.data.title}`);
  }
  revalidatePath('/admin/campanhas');
  revalidatePath('/carteira');
  return { ok: id ? 'Campanha atualizada.' : 'Campanha criada. Os estabelecimentos já podem adotar.' };
}

/** Liga ou desliga a campanha. Desligada, deixa de valer no caixa de quem adotou e some da vitrine. */
export async function adminToggleAppCampaign(formData: FormData) {
  const admin = await requireAdmin();
  const c = await prisma.appCampaign.findUnique({ where: { id: String(formData.get('id') ?? '') } });
  if (!c) return;
  await prisma.appCampaign.update({ where: { id: c.id }, data: { active: !c.active } });
  await syncCampaign(c.id, { activeChanged: true });
  await logAdmin(admin, 'campanha', `Campanha do app ${c.active ? 'desligada' : 'ligada'}: ${c.title}`);
  revalidatePath('/admin/campanhas');
  revalidatePath('/carteira');
}

// ---------------------------------------------------------------- Estabelecimento

/** O dono adota ou deixa a campanha do app. */
export async function setAppCampaign(formData: FormData) {
  const restaurant = await requirePaidRestaurant();
  const id = String(formData.get('id') ?? '');
  try {
    if (formData.get('join') === '1') await joinCampaign(restaurant.id, id);
    else await leaveCampaign(restaurant.id, id);
  } catch (e) {
    if (!(e instanceof BusinessError)) throw e;
  }
  revalidatePath('/dashboard', 'layout');
  revalidatePath('/carteira');
  revalidatePath('/lugares');
}
