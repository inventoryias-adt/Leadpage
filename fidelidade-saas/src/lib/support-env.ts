import 'server-only';
import { buildSupport, type SupportContact } from './support';

/** Contatos do suporte com assunto e mensagem prontos. E-mail em SUPPORT_EMAIL (principal) e WhatsApp em SUPPORT_WHATSAPP. */
export const getSupport = (subject: string, message: string): SupportContact =>
  buildSupport({ email: process.env.SUPPORT_EMAIL, whatsapp: process.env.SUPPORT_WHATSAPP }, subject, message);

export const supportEmail = () => (process.env.SUPPORT_EMAIL ?? '').trim() || null;
