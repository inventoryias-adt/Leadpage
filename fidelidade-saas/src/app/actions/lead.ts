'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { fail, type FormState } from '@/lib/form';
import { LEAD_STATUS, leadEmail, leadSchema, type LeadStatus } from '@/lib/lead';
import { emailConfigured, sendEmail } from '@/lib/mailer';
import { appUrl } from '@/lib/payments';
import { TOO_MANY, allow, clientIp } from '@/lib/rate-limit';
import { requireAdmin } from '@/lib/session';

/** E-mail que recebe os contatos: LEAD_EMAIL, ou o e-mail do suporte (SUPPORT_EMAIL) se não houver. */
const leadInbox = () => (process.env.LEAD_EMAIL ?? '').trim() || (process.env.SUPPORT_EMAIL ?? '').trim() || null;

/** Comerciante deixa o contato: guarda no banco (nunca se perde) e avisa o dono da plataforma por e-mail. */
export async function submitLead(_: FormState, formData: FormData): Promise<FormState> {
  // Campo-isca que só robô preenche: finge sucesso e não grava nada.
  if (String(formData.get('website') ?? '').trim()) return { ok: 'Recebemos o seu contato! Em breve a gente fala com você.' };

  const parsed = leadSchema.safeParse(Object.fromEntries(['name', 'business', 'phone', 'email', 'city', 'state', 'category', 'categoryOther', 'message', 'source'].map((k) => [k, formData.get(k) ?? ''])));
  if (!parsed.success) return fail(parsed.error.issues[0].message, formData);
  const lead = parsed.data;

  const ip = await clientIp();
  const [okIp, okEmail] = await Promise.all([allow(`lead:ip:${ip}`, 6, 3600), allow(`lead:email:${lead.email}`, 3, 86_400)]);
  if (!okIp || !okEmail) return fail(TOO_MANY, formData);

  const row = await prisma.lead.create({
    data: {
      name: lead.name,
      business: lead.business,
      phone: lead.phone,
      email: lead.email,
      city: lead.city,
      state: lead.state || null,
      category: lead.category,
      categoryOther: lead.category === 'outros' ? lead.categoryOther || null : null,
      message: lead.message || null,
      source: lead.source,
    },
  });

  const to = leadInbox();
  if (to && emailConfigured()) {
    const mail = leadEmail(row, `${appUrl()}/admin/contatos`);
    const sent = await sendEmail({ to, subject: mail.subject, text: mail.text }).catch(() => false);
    if (sent) await prisma.lead.update({ where: { id: row.id }, data: { emailSent: true } });
  }
  revalidatePath('/admin/contatos');
  return { ok: 'Recebemos o seu contato! Em breve a gente fala com você pelo WhatsApp ou e-mail.' };
}

/** Administração: muda a situação de um contato (novo, contatado, virou cliente, sem interesse). */
export async function adminSetLeadStatus(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!id || !(status in LEAD_STATUS)) return;
  await prisma.lead.updateMany({ where: { id }, data: { status: status as LeadStatus, contactedAt: status === 'NEW' ? null : new Date() } });
  revalidatePath('/admin/contatos');
}
