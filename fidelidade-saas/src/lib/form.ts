/** Estado devolvido pelas Server Actions para os formulários (useActionState). */
export type FormState = { error?: string; ok?: string; values?: Record<string, string> };

/** Horário livre sugerido quando o escolhido foi ocupado por outra pessoa. */
export type SlotOption = { date: string; time: string };
export type BookingState = FormState & { alternatives?: SlotOption[] };
/** Resultado de segurar o horário: até quando ele é do cliente, ou as saídas se alguém pegou antes. */
export type HoldState = { ok: true; expiresAt: string } | { ok: false; error: string; gone?: boolean; alternatives?: SlotOption[] };

export type BagState = FormState & { codes?: { name: string; code: string }[] };

/** Resultado de "fazer pedido": o código que o cliente mostra no balcão. */
export type OrderState = FormState & { order?: { id: string; code: string; totalCents: number; prepMin: number } };

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
