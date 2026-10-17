import type { ColorKey } from './palette';

export type NoticeKind = { icon: 'spark' | 'bag' | 'clock' | 'gift' | 'trophy' | 'bell'; color: ColorKey };

/** O aviso não guarda um tipo: ele é deduzido do título/destino para dar ícone e cor a cada cartão. */
export function noticeKind(n: { title: string; href?: string | null }): NoticeKind {
  const t = n.title.toLowerCase();
  if (/pedido/.test(t) || n.href?.includes('/pedidos')) return { icon: 'bag', color: 'laranja' };
  if (/agend|hor[aá]rio|reserva/.test(t) || n.href?.includes('/agendamentos')) return { icon: 'clock', color: 'turquesa' };
  if (/resgat|pr[eê]mio|presente|anivers/.test(t)) return { icon: 'gift', color: 'rosa' };
  if (/desafio|conquist/.test(t)) return { icon: 'trophy', color: 'roxo' };
  if (/ponto/.test(t)) return { icon: 'spark', color: 'azul' };
  return { icon: 'bell', color: 'azul' };
}
