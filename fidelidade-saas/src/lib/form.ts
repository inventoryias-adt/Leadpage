/** Estado devolvido pelas Server Actions para os formulários (useActionState). */
export type FormState = { error?: string; ok?: string; values?: Record<string, string> };

export type BagState = FormState & { codes?: { name: string; code: string }[] };

/**
 * Erro de formulário que devolve o que o usuário digitou (menos senhas): o React 19 limpa os
 * campos não controlados após cada action, então reaproveitamos esses valores como defaultValue.
 */
export function fail(error: string, formData: FormData): FormState {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string' && !/password|senha|token|data$/i.test(key)) values[key] = value;
  }
  return { error, values };
}

/** Só aceita caminhos internos, evitando open redirect via ?next=. */
export function safeNext(next: unknown, fallback: string): string {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : fallback;
}
