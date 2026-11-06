import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/** Cifra um segredo curto (ex.: token do Google) com AES-256-GCM. A chave vem de GOOGLE_TOKEN_KEY (mínimo 16 caracteres). */
function key(): Buffer {
  const k = process.env.GOOGLE_TOKEN_KEY;
  if (!k || k.length < 16) throw new Error('GOOGLE_TOKEN_KEY ausente ou curta demais (mínimo 16 caracteres).');
  return createHash('sha256').update(k).digest();
}

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), enc.toString('base64')].join('.');
}

export function open(sealed: string): string {
  const [v, iv, tag, enc] = sealed.split('.');
  if (v !== 'v1' || !iv || !tag || !enc) throw new Error('Segredo em formato desconhecido.');
  const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(enc, 'base64')), d.final()]).toString('utf8');
}
