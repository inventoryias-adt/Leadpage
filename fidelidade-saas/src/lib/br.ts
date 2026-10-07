/** Utilitários de CPF e telefone (Brasil). Armazenamos sempre apenas dígitos. */

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function isValidCpf(input: string): boolean {
  const cpf = onlyDigits(input);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const check = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === Number(cpf[9]) && check(10) === Number(cpf[10]);
}

export function formatCpf(cpf: string): string {
  const d = onlyDigits(cpf).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

/** Mascara para exibição pública: ***.456.789-** */
export function maskCpf(cpf: string): string {
  const d = onlyDigits(cpf);
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

/** Aceita "+55 (11) 91234-5678", "11912345678"... e devolve DDD+número (10 ou 11 dígitos), ou null. */
export function normalizePhone(input: string): string | null {
  let d = onlyDigits(input);
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return null;
  if (d.startsWith('0')) return null;
  return d;
}

export function formatPhone(phone: string): string {
  const d = onlyDigits(phone);
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  return phone;
}
