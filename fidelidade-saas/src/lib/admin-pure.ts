import { createHash, randomBytes } from 'node:crypto';

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

/** Gera um token de convite (vai no link) e o hash que fica no banco. */
export function newInvite() {
  const token = randomBytes(24).toString('base64url');
  return { token, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000) };
}

export const hashInviteToken = sha256;

/** Senha temporária legível (sem 0/O/1/l), exibida uma única vez para a administração repassar. */
export function tempPassword(len = 12) {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(len);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

/** Regra de senha do administrador: 10+ caracteres, com letra e número. */
export function adminPasswordIssue(p: string): string | null {
  if (p.length < 10) return 'A senha precisa ter pelo menos 10 caracteres.';
  if (p.length > 72) return 'A senha pode ter no máximo 72 caracteres.';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Use letras e números na senha.';
  return null;
}
