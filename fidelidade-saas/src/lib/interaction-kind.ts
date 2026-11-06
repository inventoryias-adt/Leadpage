/** Que tipo de ação é, pelo texto que o dono cadastrou. Puro: serve ao navegador e ao servidor. */
export type ActionKind = 'google' | 'instagram' | 'other';

export function actionKind(label: string): ActionKind {
  const t = label.toLowerCase();
  if (/google|avalia/.test(t)) return 'google';
  if (/instagram|story|stories|foto|post|marc/.test(t)) return 'instagram';
  return 'other';
}

/** O texto da ação como o cliente lê: "Avaliação 5 estrelas no Google" vira "Avaliação no Google" (não dá para conferir a nota). */
export function actionTitle(label: string): string {
  return label.replace(/\s*\b5\s*estrelas?\b\s*/i, ' ').replace(/\s{2,}/g, ' ').trim();
}
