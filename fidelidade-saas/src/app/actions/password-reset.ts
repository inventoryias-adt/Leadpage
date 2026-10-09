'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { emailConfigured, sendEmail } from '@/lib/mailer';
import { hashPassword } from '@/lib/password';
import { KIND_SEGMENT, RESET_TTL_MINUTES, hashResetToken, looksLikeToken, newResetToken, resetEmailText, segmentKind, type ResetKind } from '@/lib/password-reset';
import { appUrl } from '@/lib/payments';
import { TOO_MANY, allow, clientIp } from '@/lib/rate-limit';
import { fail, type FormState } from '@/lib/form';

const GENERIC = 'Se este e-mail tiver cadastro, enviamos um link para criar uma senha nova. Confira também a caixa de spam. O link vale por 1 hora.';

/** Pede o link: a resposta é sempre a mesma, exista o e-mail ou não (não revela quem tem cadastro). */
async function request(kind: ResetKind, formData: FormData): Promise<FormState> {
  const parsed = z.object({ email: z.string().trim().toLowerCase().email('Informe um e-mail válido.').max(120) }).safeParse({ email: formData.get('email') ?? '' });
  if (!parsed.success) return fail(parsed.error.issues[0].message, formData);
  if (!emailConfigured()) return fail('A recuperação por e-mail ainda não está disponível. Fale com o suporte.', formData);

  const { email } = parsed.data;
  const ip = await clientIp();
  const [okIp, okEmail] = await Promise.all([allow(`reset:ip:${ip}`, 10, 900), allow(`reset:email:${email}`, 3, 900)]);
  if (!okIp || !okEmail) return fail(TOO_MANY, formData);

  const subject =
    kind === 'customer'
      ? await prisma.customer.findUnique({ where: { email }, select: { id: true, name: true } })
      : await prisma.restaurant.findUnique({ where: { email }, select: { id: true, name: true } });
  if (subject) {
    const token = newResetToken();
    await prisma.$transaction([
      prisma.passwordReset.deleteMany({ where: { kind, subjectId: subject.id, usedAt: null } }),
      prisma.passwordReset.create({ data: { kind, subjectId: subject.id, tokenHash: hashResetToken(token), expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60_000) } }),
    ]);
    const base = appUrl(); // nunca o cabeçalho Host/Origin: quem pede o link não escolhe o domínio dele
    await sendEmail({
      to: email,
      subject: 'Redefinir sua senha do Fidelize',
      text: resetEmailText(subject.name, `${base}/redefinir/${KIND_SEGMENT[kind]}/${token}`),
    });
  }
  return { ok: GENERIC };
}

export const requestCustomerReset = async (_: FormState, formData: FormData) => request('customer', formData);
export const requestOwnerReset = async (_: FormState, formData: FormData) => request('restaurant', formData);

const resetSchema = z.object({
  tipo: z.string(),
  token: z.string(),
  password: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.').max(72, 'A senha pode ter no máximo 72 caracteres.'),
  confirm: z.string(),
});

/** Define a senha nova a partir do link. Uso único; o link morre ao ser usado. */
export async function resetPassword(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse({ tipo: formData.get('tipo') ?? '', token: formData.get('token') ?? '', password: formData.get('password') ?? '', confirm: formData.get('confirm') ?? '' });
  if (!parsed.success) return fail(parsed.error.issues[0].message, formData);
  const kind = segmentKind(parsed.data.tipo);
  if (!kind || !looksLikeToken(parsed.data.token)) return fail('Link inválido ou vencido. Peça um novo.', formData);
  if (parsed.data.password !== parsed.data.confirm) return fail('As senhas não são iguais.', formData);
  if (!(await allow(`resetpw:ip:${await clientIp()}`, 20, 900))) return fail(TOO_MANY, formData);

  const reset = await prisma.passwordReset.findFirst({ where: { tokenHash: hashResetToken(parsed.data.token), kind, usedAt: null, expiresAt: { gt: new Date() } } });
  if (!reset) return fail('Link inválido ou vencido. Peça um novo.', formData);

  const passwordHash = await hashPassword(parsed.data.password);
  // Uso único: só quem marcar o link como usado primeiro troca a senha.
  const claimed = await prisma.passwordReset.updateMany({ where: { id: reset.id, usedAt: null }, data: { usedAt: new Date() } });
  if (claimed.count !== 1) return fail('Link inválido ou vencido. Peça um novo.', formData);
  if (kind === 'customer') await prisma.customer.update({ where: { id: reset.subjectId }, data: { passwordHash } });
  else await prisma.restaurant.update({ where: { id: reset.subjectId }, data: { passwordHash } });
  await prisma.passwordReset.deleteMany({ where: { kind, subjectId: reset.subjectId, usedAt: null } });
  return { ok: 'Senha alterada. Já pode entrar com a senha nova.' };
}
