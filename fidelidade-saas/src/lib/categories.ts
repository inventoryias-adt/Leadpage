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
  { value: 'outros', label: 'Outros' },
] as const;

export type CategoryValue = (typeof CATEGORIES)[number]['value'];

export const categoryLabel = (value: string | null | undefined) => CATEGORIES.find((c) => c.value === value)?.label ?? null;
export const isCategory = (value: string): value is CategoryValue => CATEGORIES.some((c) => c.value === value);
