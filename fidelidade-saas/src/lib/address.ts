/** Endereço da unidade: CEP, número e complemento, com o texto final montado a partir das partes. */

export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'] as const;

export const cepDigits = (v: string) => v.replace(/\D/g, '').slice(0, 8);

/** "04204000" → "04204-000" (aceita digitação parcial). */
export function maskCep(v: string) {
  const d = cepDigits(v);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export type AddressParts = {
  street: string;
  number: string;
  complement?: string;
  district?: string;
  city: string;
  state: string;
};

/** "Rua Costa Aguiar, 100 - Apto 2, Ipiranga, São Paulo - SP" */
export function composeAddress(p: AddressParts): string {
  const line1 = [p.street.trim(), p.number.trim()].filter(Boolean).join(', ') + (p.complement?.trim() ? ` - ${p.complement.trim()}` : '');
  const cityUf = [p.city.trim(), p.state.trim()].filter(Boolean).join(' - ');
  return [line1, p.district?.trim(), cityUf].filter(Boolean).join(', ');
}

type ViaCep = { erro?: boolean | string; logradouro?: string; bairro?: string; localidade?: string; uf?: string };

/** Lê a resposta do ViaCEP; devolve null para CEP inexistente. */
export function parseViaCep(j: ViaCep): Pick<AddressParts, 'street' | 'district' | 'city' | 'state'> | null {
  if (!j || j.erro) return null;
  return { street: j.logradouro ?? '', district: j.bairro ?? '', city: j.localidade ?? '', state: j.uf ?? '' };
}
