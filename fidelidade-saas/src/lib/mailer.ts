import 'server-only';
import nodemailer from 'nodemailer';
import { pickProvider } from './mail-provider';

/**
 * Envio de e-mail. Dois provedores, na ordem:
 *  1. SMTP (SMTP_HOST, SMTP_USER, SMTP_PASS; SMTP_PORT opcional): funciona sem domínio próprio, por exemplo com uma conta Gmail
 *     e uma "senha de app" (host smtp.gmail.com, porta 465). Entrega para qualquer destinatário.
 *  2. Resend (RESEND_API_KEY): sem domínio verificado só entrega para o e-mail dono da conta do Resend.
 * EMAIL_FROM (ex.: "Fidelize <suporte@seudominio.com.br>"; no Gmail, o próprio endereço da conta).
 * Em desenvolvimento, DEV_MAIL_FILE grava as mensagens em um arquivo em vez de enviar (nunca em produção).
 */
export type Mail = { to: string; subject: string; text: string };

const devFile = () => (process.env.NODE_ENV !== 'production' ? process.env.DEV_MAIL_FILE : undefined);

export const emailConfigured = () => pickProvider(process.env) !== null || !!devFile();

const from = () => process.env.EMAIL_FROM || (process.env.SMTP_USER ? `Fidelize <${process.env.SMTP_USER}>` : 'Fidelize <onboarding@resend.dev>');

async function viaSmtp(mail: Mail): Promise<boolean> {
  const port = Number(process.env.SMTP_PORT) || 465;
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // 465 = TLS direto; 587 = STARTTLS
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  });
  try {
    await transport.sendMail({ from: from(), to: mail.to, subject: mail.subject, text: mail.text });
    return true;
  } catch (e) {
    console.error('Falha ao enviar e-mail por SMTP', e instanceof Error ? e.message : e);
    return false;
  } finally {
    transport.close();
  }
}

async function viaResend(mail: Mail): Promise<boolean> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: from(), to: [mail.to], subject: mail.subject, text: mail.text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error('Resend recusou o e-mail', res.status, (await res.text()).slice(0, 200));
    return res.ok;
  } catch (e) {
    console.error('Falha ao enviar e-mail', e instanceof Error ? e.message : e);
    return false;
  }
}

export async function sendEmail(mail: Mail): Promise<boolean> {
  const file = devFile();
  if (file) {
    const { appendFile } = await import('node:fs/promises');
    await appendFile(file, `${JSON.stringify({ ...mail, at: new Date().toISOString() })}\n`);
    return true;
  }
  const provider = pickProvider(process.env);
  if (provider === 'smtp') return viaSmtp(mail);
  if (provider === 'resend') return viaResend(mail);
  return false;
}
