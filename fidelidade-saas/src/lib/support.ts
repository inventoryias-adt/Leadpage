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
