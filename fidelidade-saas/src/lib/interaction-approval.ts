/** Como os pontos de uma interação (Google, Instagram…) são confirmados. Puro: serve ao navegador e ao servidor. */
export const APPROVALS = ['COUNTER', 'MANUAL', 'AUTO'] as const;
export type Approval = (typeof APPROVALS)[number];

export const APPROVAL_LABEL: Record<Approval, string> = {
  COUNTER: 'Só no balcão (o cliente mostra ao caixa)',
  MANUAL: 'Eu aprovo cada pedido do cliente',
  AUTO: 'Automático em 24 h (eu posso recusar antes)',
};

export const isApproval = (v: unknown): v is Approval => typeof v === 'string' && (APPROVALS as readonly string[]).includes(v);

/** Depois de aprovada, a mesma interação só pode ser pedida de novo depois deste prazo. */
export const INTERACTION_COOLDOWN_DAYS = 30;
/** Na regra AUTO, quanto tempo o dono tem para recusar antes de os pontos entrarem sozinhos. */
export const AUTO_APPROVE_HOURS = 24;

/** "há 5 min", "há 3 h", "há 2 dias" */
export function agoText(from: Date, now = new Date()): string {
  const min = Math.max(0, Math.round((now.getTime() - from.getTime()) / 60_000));
  if (min < 1) return 'agora há pouco';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return `há ${d} ${d === 1 ? 'dia' : 'dias'}`;
}

/** "libera em 5 h" / "libera em 40 min" (para o pedido em modo automático) */
export function releaseText(at: Date, now = new Date()): string {
  const min = Math.max(0, Math.round((at.getTime() - now.getTime()) / 60_000));
  if (min < 60) return `libera em ${Math.max(1, min)} min`;
  return `libera em ${Math.round(min / 60)} h`;
}
