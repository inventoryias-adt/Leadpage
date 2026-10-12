/** Link do WhatsApp do suporte com a mensagem pronta. `number` = só dígitos com DDI (ex.: 5511999998888); vazio = indisponível. */
export function supportLink(number: string | undefined | null, message: string): string | null {
  const digits = (number ?? '').replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function categoryRequestMessage(placeName: string, typed: string): string {
  const what = typed.trim();
  return `Olá! Sou do estabelecimento "${placeName}" no Fidelize e não encontrei a minha categoria${what ? `: ${what}` : ''}. Podem criar ou ajustar?`;
}

/** Contatos do suporte: o e-mail é o canal principal e o WhatsApp é o complemento. Qualquer um pode estar ausente. */
export type SupportContact = { email: string | null; emailHref: string | null; whatsappHref: string | null };

/** `mailto:` com assunto e texto prontos. `email` vazio ou inválido = indisponível. */
export function mailtoLink(email: string | undefined | null, subject: string, body: string): string | null {
  const to = (email ?? '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return null;
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Monta os contatos a partir das variáveis de ambiente (lidas no servidor) e da mensagem pronta. */
export function buildSupport(env: { email?: string | null; whatsapp?: string | null }, subject: string, message: string): SupportContact {
  const emailHref = mailtoLink(env.email, subject, message);
  return {
    email: emailHref ? (env.email ?? '').trim() : null,
    emailHref,
    whatsappHref: supportLink(env.whatsapp, message),
  };
}
