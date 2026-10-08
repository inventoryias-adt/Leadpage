/** Categorias da vitrine "Lugares". */
export const CATEGORIES = [
  { value: 'pizza', label: 'Pizza' },
  { value: 'hamburguer', label: 'Hambúrguer' },
  { value: 'japones', label: 'Japonês' },
  { value: 'churrasco', label: 'Churrasco' },
  { value: 'brasileira', label: 'Comida brasileira' },
  { value: 'massas', label: 'Massas' },
  { value: 'lanches', label: 'Lanches' },
  { value: 'acai', label: 'Açaí' },
  { value: 'sorvete', label: 'Sorvetes' },
  { value: 'cafe', label: 'Café' },
  { value: 'padaria', label: 'Padaria' },
  { value: 'doces', label: 'Doces e sobremesas' },
  { value: 'saudavel', label: 'Saudável' },
  { value: 'bar', label: 'Bar e petiscos' },
  { value: 'barbearia', label: 'Barbearia' },
  { value: 'estetica', label: 'Estética e saúde' },
  { value: 'pet', label: 'Pet shop' },
  { value: 'farmacia', label: 'Farmácia' },
  { value: 'servicos', label: 'Serviços' },
  { value: 'academia', label: 'Academia e fitness' },
  { value: 'mercado', label: 'Mercado e empório' },
  { value: 'moda', label: 'Moda e acessórios' },
  { value: 'outros', label: 'Outros' },
] as const;

/** Exemplos que ajudam o dono a achar a categoria certa. */
export const CATEGORY_HINT: Record<string, string> = {
  estetica: 'dentista, salão de beleza, manicure, clínica',
  pet: 'banho e tosa, veterinário, ração',
  farmacia: 'drogaria, manipulação',
  servicos: 'reformas, manutenção, borracheiro, chaveiro',
  academia: 'musculação, pilates, estúdio',
  mercado: 'mercadinho, hortifruti, empório',
  moda: 'roupas, calçados, bijuterias',
  outros: 'não achou a sua? Escreva qual é',
};

export type CategoryValue = (typeof CATEGORIES)[number]['value'];

/** Nome da categoria; em "Outros" mostra o texto livre do estabelecimento (ex.: "Outros · Doceria"). */
export const categoryLabel = (value: string | null | undefined, other?: string | null) => {
  const label = CATEGORIES.find((c) => c.value === value)?.label ?? null;
  return label && value === 'outros' && other?.trim() ? `${label} · ${other.trim()}` : label;
};
export const isCategory = (value: string): value is CategoryValue => CATEGORIES.some((c) => c.value === value);
