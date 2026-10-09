import 'server-only';

/**
 * Envio de e-mail (Resend). Variáveis: RESEND_API_KEY e EMAIL_FROM (ex.: "Fidelize <nao-responda@seudominio.com.br>").
 * Sem domínio verificado o Resend só entrega para o e-mail do dono da conta; por isso o remetente padrão é o de teste.
 * Em desenvolvimento, DEV_MAIL_FILE grava as mensagens em um arquivo em vez de enviar (nunca em produção).
 */
export type Mail = { to: string; subject: string; text: string };

const devFile = () => (process.env.NODE_ENV !== 'production' ? process.env.DEV_MAIL_FILE : undefined);

export const emailConfigured = () => !!process.env.RESEND_API_KEY || !!devFile();

export async function sendEmail(mail: Mail): Promise<boolean> {
  const file = devFile();
  if (file) {
    const { appendFile } = await import('node:fs/promises');
    await appendFile(file, `${JSON.stringify({ ...mail, at: new Date().toISOString() })}\n`);
    return true;
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM || 'Fidelize <onboarding@resend.dev>', to: [mail.to], subject: mail.subject, text: mail.text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error('Resend recusou o e-mail', res.status, (await res.text()).slice(0, 200));
    return res.ok;
  } catch (e) {
    console.error('Falha ao enviar e-mail', e instanceof Error ? e.message : e);
    return false;
  }
}
