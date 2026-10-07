'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { adminPasswordIssue, hashInviteToken, logAdmin, tempPassword } from '@/lib/admin';
import { normalizePhone } from '@/lib/br';
import { prisma } from '@/lib/db';
import { fail, type FormState } from '@/lib/form';
import { dummyHash, hashPassword, verifyPassword } from '@/lib/password';
import { TOO_MANY, allow, clientIp } from '@/lib/rate-limit';
import { endAdminSession, endRestaurantSession, requireAdmin, startAdminSession, startImpersonation } from '@/lib/session';

const firstIssue = (e: z.ZodError) => e.issues[0].message;

// ---------------------------------------------------------------- Entrada do administrador

export async function adminLogin(_: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  // Mais rígido que o login dos assinantes: é a porta de entrada da plataforma inteira.
  const ip = await clientIp();
  const [okIp, okEmail] = await Promise.all([allow(`admin:ip:${ip}`, 12, 900), allow(`admin:email:${email}`, 6, 900)]);
  if (!okIp || !okEmail) return fail(TOO_MANY, formData);

  const admin = await prisma.adminUser.findUnique({ where: { email } });
  const ok = await verifyPassword(password, admin?.passwordHash ?? (await dummyHash()));
  if (!admin || !admin.active || !admin.passwordHash || !ok) return fail('E-mail ou senha incorretos.', formData);

  await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
  await startAdminSession(admin.id);
  redirect('/admin');
}

export async function adminLogout() {
  await endAdminSession();
  redirect('/admin/entrar');
}

/** Aceita o convite: define a senha de quem recebeu o link. */
export async function acceptInvite(_: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get('token') ?? '');
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  if (!(await allow(`admin-invite:${await clientIp()}`, 10, 900))) return fail(TOO_MANY, formData);
  const issue = adminPasswordIssue(password);
  if (issue) return fail(issue, formData);
  if (password !== confirm) return fail('As senhas não são iguais.', formData);

  const admin = await prisma.adminUser.findUnique({ where: { inviteTokenHash: hashInviteToken(token) } });
  if (!admin || !admin.active || !admin.inviteExpiresAt || admin.inviteExpiresAt < new Date()) {
    return fail('Este convite não é mais válido. Peça um novo.', formData);
  }

  // O convite só vale uma vez: o hash sai do banco junto com a gravação da senha.
  const done = await prisma.adminUser.updateMany({
    where: { id: admin.id, inviteTokenHash: admin.inviteTokenHash },
    data: { passwordHash: await hashPassword(password), inviteTokenHash: null, inviteExpiresAt: null, lastLoginAt: new Date() },
  });
  if (done.count !== 1) return fail('Este convite não é mais válido. Peça um novo.', formData);

  await logAdmin(admin, 'convite', 'Senha definida pelo convite');
  await startAdminSession(admin.id);
  redirect('/admin');
}

// ---------------------------------------------------------------- Ações nas contas dos assinantes

async function target(id: string) {
  return prisma.restaurant.findUnique({ where: { id: String(id) } });
}

const STATUS_LABEL = { PENDING: 'Aguardando pagamento', ACTIVE: 'Ativa', PAST_DUE: 'Inadimplente', CANCELED: 'Cancelada' } as const;

export async function adminSetStatus(_: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({ id: z.string(), status: z.enum(['PENDING', 'ACTIVE', 'PAST_DUE', 'CANCELED']), reason: z.string().trim().max(200).default('') })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail('Escolha um status válido.', formData);
  const r = await target(parsed.data.id);
  if (!r) return { error: 'Assinante não encontrado.' };
  if (r.subscriptionStatus === parsed.data.status) return fail('Esta conta já está com esse status.', formData);

  await prisma.restaurant.update({ where: { id: r.id }, data: { subscriptionStatus: parsed.data.status } });
  await logAdmin(admin, 'status', `${STATUS_LABEL[r.subscriptionStatus]} → ${STATUS_LABEL[parsed.data.status]}${parsed.data.reason ? ` · ${parsed.data.reason}` : ''}`, r);
  revalidatePath('/admin', 'layout');
  return { ok: `Status alterado para “${STATUS_LABEL[parsed.data.status]}”.` };
}

const editSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(2, 'Informe o nome do estabelecimento.').max(80),
  phone: z.string().refine((v) => normalizePhone(v) !== null, 'Telefone inválido. Use DDD + número.'),
  pointsPerReal: z.coerce.number().int('Pontos por real: use número inteiro.').min(1).max(1000),
  maxRedeemsPerMonth: z.coerce.number().int('Limite de resgates: use número inteiro.').min(1).max(100),
  checkInPoints: z.coerce.number().int().min(0).max(1000),
  referralPoints: z.coerce.number().int().min(0).max(100_000),
});

export async function adminUpdateRestaurant(_: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = editSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstIssue(parsed.error), formData);
  const d = parsed.data;
  const r = await target(d.id);
  if (!r) return { error: 'Assinante não encontrado.' };
  const listed = formData.get('listed') === 'on';

  const next = { name: d.name, phone: normalizePhone(d.phone)!, pointsPerReal: d.pointsPerReal, maxRedeemsPerMonth: d.maxRedeemsPerMonth, checkInPoints: d.checkInPoints, referralPoints: d.referralPoints, listed };
  const LABEL: Record<string, string> = { name: 'Nome', phone: 'Telefone', pointsPerReal: 'Pontos por real', maxRedeemsPerMonth: 'Resgates por CPF/mês', checkInPoints: 'Pontos de check-in', referralPoints: 'Pontos de indicação', listed: 'Na vitrine' };
  const show = (v: unknown) => (typeof v === 'boolean' ? (v ? 'sim' : 'não') : String(v));
  const changed = Object.entries(next)
    .filter(([k, v]) => (r as Record<string, unknown>)[k] !== v)
    .map(([k, v]) => `${LABEL[k] ?? k}: ${show((r as Record<string, unknown>)[k])} → ${show(v)}`);
  if (changed.length === 0) return fail('Nada para salvar: os dados são os mesmos.', formData);

  await prisma.restaurant.update({ where: { id: r.id }, data: next });
  await logAdmin(admin, 'editar', changed.join(' · '), r);
  revalidatePath('/admin', 'layout');
  return { ok: 'Dados salvos.' };
}

export type ResetState = { error?: string; password?: string };

/** Gera uma senha temporária e a mostra uma única vez (não existe envio por e-mail ainda). */
export async function adminResetPassword(_: ResetState, formData: FormData): Promise<ResetState> {
  const admin = await requireAdmin();
  const r = await target(String(formData.get('id') ?? ''));
  if (!r) return { error: 'Assinante não encontrado.' };
  const password = tempPassword();
  await prisma.restaurant.update({ where: { id: r.id }, data: { passwordHash: await hashPassword(password) } });
  await logAdmin(admin, 'senha', 'Senha temporária gerada', r);
  return { password };
}

export async function adminResetGuide(formData: FormData) {
  const admin = await requireAdmin();
  const r = await target(String(formData.get('id') ?? ''));
  if (!r) return;
  await prisma.restaurant.update({ where: { id: r.id }, data: { guideDoneAt: null } });
  await logAdmin(admin, 'guia', 'Guia inicial reaberto', r);
  revalidatePath(`/admin/assinantes/${r.id}`);
}

export async function adminSaveNote(_: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const note = String(formData.get('note') ?? '').trim().slice(0, 2000);
  const r = await target(String(formData.get('id') ?? ''));
  if (!r) return { error: 'Assinante não encontrado.' };
  await prisma.restaurant.update({ where: { id: r.id }, data: { internalNote: note || null } });
  await logAdmin(admin, 'nota', note ? 'Anotação interna atualizada' : 'Anotação interna removida', r);
  revalidatePath(`/admin/assinantes/${r.id}`);
  return { ok: 'Anotação salva.' };
}

/** Suporte: entra no painel do assinante (2 horas, com faixa de aviso e registro). */
export async function adminImpersonate(formData: FormData) {
  const admin = await requireAdmin();
  const r = await target(String(formData.get('id') ?? ''));
  if (!r) redirect('/admin/assinantes');
  await logAdmin(admin, 'impersonar', 'Entrou no painel do assinante (suporte)', r);
  await startImpersonation(r.id);
  redirect('/dashboard');
}

/** Sai do modo suporte e volta para a ficha do assinante. */
export async function exitImpersonation(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  await endRestaurantSession();
  redirect(/^[0-9a-f-]{36}$/.test(id) ? `/admin/assinantes/${id}` : '/admin/assinantes');
}
