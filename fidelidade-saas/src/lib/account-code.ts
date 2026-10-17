/** ID da conta do cliente: "FZ-" + 6 caracteres sem ambiguidade (sem 0/O, 1/I). Puro: serve ao navegador e ao servidor. */
export const ACCOUNT_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Aceita "fz-7k3q9x", "FZ 7K3Q9X", "7k3q9x"… e devolve "FZ-7K3Q9X"; texto que não é um ID devolve null. */
export function normalizeAccountCode(raw: string): string | null {
  const t = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = t.startsWith('FZ') ? t.slice(2) : t;
  if (body.length !== 6 || [...body].some((ch) => !ACCOUNT_ALPHABET.includes(ch))) return null;
  return `FZ-${body}`;
}

/** O campo do caixa tem letras? Então quem digitou foi um ID, não um CPF (que só tem números). */
export const looksLikeAccountCode = (raw: string) => /[a-z]/i.test(raw);
