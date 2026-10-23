/** Regras do chat entre cliente e estabelecimento (sem banco, para testar): texto, limites e rótulos de hora. */
import { cleanText } from './reviews';

export const CHAT_MAX = 1000;
/** No máximo tantas mensagens por pessoa a cada hora (evita enxurrada). */
export const CHAT_PER_HOUR = 60;
export type ChatSender = 'CUSTOMER' | 'RESTAURANT';

/** Texto da mensagem: apara espaços, junta linhas em branco demais e limita a 1000 letras; vazio → erro. */
export function parseMessage(raw: unknown): { ok: true; body: string } | { ok: false; error: string } {
  const body = cleanText(raw, CHAT_MAX);
  if (!body) return { ok: false, error: 'Escreva a mensagem.' };
  return { ok: true, body };
}

/** Quantas mensagens do outro lado ainda não foram vistas por quem lê (`readAt` = até quando já viu). */
export function unreadFor(me: ChatSender, messages: { sender: string; createdAt: Date }[], readAt: Date | null) {
  return messages.filter((m) => m.sender !== me && (!readAt || m.createdAt > readAt)).length;
}

/** Prévia de uma linha para a lista de conversas. */
export function preview(body: string, max = 70) {
  const one = body.replace(/\s+/g, ' ').trim();
  return one.length > max ? `${one.slice(0, max - 1)}…` : one;
}

/** "14:32" hoje; "ontem 14:32"; "seg 14:32" na semana; senão "12/10 14:32" (sempre no horário de Brasília). */
export function chatTime(at: Date, now: Date = new Date()): string {
  const tz = 'America/Sao_Paulo';
  const day = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: tz });
  const hm = at.toLocaleTimeString('pt-BR', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
  const diff = Math.round((Date.parse(day(now)) - Date.parse(day(at))) / 86400000);
  if (diff <= 0) return hm;
  if (diff === 1) return `ontem ${hm}`;
  if (diff < 7) return `${at.toLocaleDateString('pt-BR', { timeZone: tz, weekday: 'short' }).replace('.', '')} ${hm}`;
  return `${at.toLocaleDateString('pt-BR', { timeZone: tz, day: '2-digit', month: '2-digit' })} ${hm}`;
}
