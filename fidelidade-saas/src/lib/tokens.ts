import { randomBytes, randomInt } from 'node:crypto';

/** Token imprevisível para o QR Code / link (192 bits). */
export function newClaimToken(): string {
  return randomBytes(24).toString('base64url');
}

// Sem caracteres ambíguos (0/O, 1/I) para o cliente ditar o código no balcão.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function newVoucherCode(): string {
  let out = '';
  for (let i = 0; i < 6; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/** Código curto do link "Indique amigos" (8 caracteres sem ambiguidade). */
export function newReferralCode(): string {
  let out = '';
  for (let i = 0; i < 8; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}
