import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';

/**
 * Hash de senha com scrypt nativo do Node (roda fora da thread principal e é bem mais rápido que o
 * bcryptjs em JavaScript puro, que travava o login por centenas de milissegundos).
 * Hashes bcrypt antigos continuam sendo aceitos.
 */
const N = 16384;
const R = 8;
const P = 1;

function scrypt(password: string, salt: Buffer, keylen: number, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password, salt, keylen, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (stored.startsWith('scrypt$')) {
    const [, n, r, p, salt, key] = stored.split('$');
    const expected = Buffer.from(key, 'base64');
    const actual = await scrypt(password, Buffer.from(salt, 'base64'), expected.length, Number(n), Number(r), Number(p));
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
  if (stored.startsWith('$2')) return bcrypt.compare(password, stored);
  return false;
}

let dummy: Promise<string> | undefined;
/** Hash descartável para gastar o mesmo tempo quando o e-mail não existe (evita enumerar contas). */
export const dummyHash = () => (dummy ??= hashPassword('senha-inexistente'));
