export type Provider = 'smtp' | 'resend' | null;

/** Qual provedor de e-mail está configurado (SMTP tem prioridade). Pura, para poder ser testada. */
export function pickProvider(env: Record<string, string | undefined>): Provider {
  if (env.SMTP_HOST?.trim() && env.SMTP_USER?.trim() && env.SMTP_PASS?.trim()) return 'smtp';
  if (env.RESEND_API_KEY?.trim()) return 'resend';
  return null;
}
