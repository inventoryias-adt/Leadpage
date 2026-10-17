import { z } from 'zod';
import { UFS } from './address';
import { formatPhone, normalizePhone } from './br';
import { CATEGORIES, categoryLabel } from './categories';

/** Contato de comerciante interessado: validação, texto do e-mail e link de WhatsApp. Sem acesso ao banco (testável). */
export const LEAD_SOURCES = ['qr', 'app', 'site'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];
export const SOURCE_LABEL: Record<LeadSource, string> = { qr: 'QR Code do cartaz', app: 'App do cliente', site: 'Site' };

export const LEAD_STATUS = { NEW: 'Novo', CONTACTED: 'Contatado', WON: 'Virou cliente', LOST: 'Sem interesse' } as const;
export type LeadStatus = keyof typeof LEAD_STATUS;

const text = (min: number, max: number, label: string) =>
  z.string().trim().min(min, `Informe ${label}.`).max(max, `${label[0].toUpperCase()}${label.slice(1)} está muito longo.`);

export const leadSchema = z.object({
  name: text(2, 80, 'o seu nome'),
  business: text(2, 80, 'o nome do seu negócio'),
  phone: z
    .string()
    .transform((v, ctx) => {
      const p = normalizePhone(v);
      if (!p) ctx.addIssue({ code: 'custom', message: 'Informe um telefone com DDD, por exemplo (11) 91234-5678.' });
      return p ?? '';
    }),
  email: z.string().trim().toLowerCase().email('Informe um e-mail válido.').max(120, 'O e-mail está muito longo.'),
  city: text(2, 60, 'a cidade'),
  state: z.string().trim().toUpperCase().refine((v) => v === '' || (UFS as readonly string[]).includes(v), 'Escolha um estado válido.').optional().default(''),
  category: z.string().refine((v) => CATEGORIES.some((c) => c.value === v), 'Escolha o ramo do seu negócio.'),
  categoryOther: z.string().trim().max(60, 'O ramo está muito longo.').optional().default(''),
  message: z.string().trim().max(400, 'A mensagem pode ter no máximo 400 caracteres.').optional().default(''),
  source: z.string().optional().default('app').transform((v) => ((LEAD_SOURCES as readonly string[]).includes(v) ? (v as LeadSource) : 'app')),
});
export type LeadInput = z.infer<typeof leadSchema>;

/** Link do WhatsApp para falar com o interessado (já com uma abertura de conversa). */
export function leadWhatsapp(phone: string, name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? name;
  const msg = `Oi ${first}! Aqui é do Fidelize. Vi que você quer o clube de pontos no seu negócio. Podemos conversar?`;
  return `https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`;
}

type LeadView = { name: string; business: string; phone: string; email: string; city: string; state?: string | null; category: string; categoryOther?: string | null; message?: string | null; source: string };

/** E-mail que chega ao dono da plataforma quando um comerciante deixa o contato. */
export function leadEmail(l: LeadView, adminUrl: string): { subject: string; text: string } {
  const ramo = categoryLabel(l.category, l.categoryOther) ?? l.category;
  const onde = [l.city, l.state].filter(Boolean).join(' / ');
  const origem = SOURCE_LABEL[l.source as LeadSource] ?? l.source;
  return {
    subject: `Novo interessado no Fidelize: ${l.business} (${onde})`,
    text: [
      'Um comerciante quer o Fidelize no negócio dele.',
      '',
      `Nome: ${l.name}`,
      `Negócio: ${l.business}`,
      `Ramo: ${ramo}`,
      `Cidade: ${onde}`,
      `Telefone/WhatsApp: ${formatPhone(l.phone)}`,
      `E-mail: ${l.email}`,
      l.message ? `Mensagem: ${l.message}` : null,
      `Origem: ${origem}`,
      '',
      `Chamar no WhatsApp: ${leadWhatsapp(l.phone, l.name)}`,
      `Todos os contatos: ${adminUrl}`,
    ]
      .filter((x) => x !== null)
      .join('\n'),
  };
}
