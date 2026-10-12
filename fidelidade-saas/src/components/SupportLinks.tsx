import type { SupportContact } from '@/lib/support';

/** "E-mail ou WhatsApp": o e-mail aparece primeiro (canal principal). Não renderiza nada sem nenhum contato. */
export function SupportLinks({ support, lead = 'Falar com o suporte:' }: { support: SupportContact | null; lead?: string }) {
  if (!support || (!support.emailHref && !support.whatsappHref)) return null;
  return (
    <span>
      {lead}{' '}
      {support.emailHref && <a href={support.emailHref} className="link-inline">E-mail</a>}
      {support.emailHref && support.whatsappHref && ' · '}
      {support.whatsappHref && <a href={support.whatsappHref} target="_blank" rel="noopener noreferrer" className="link-inline">WhatsApp</a>}
    </span>
  );
}
