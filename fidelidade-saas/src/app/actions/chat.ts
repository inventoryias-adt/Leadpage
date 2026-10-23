'use server';

import { revalidatePath } from 'next/cache';
import { BusinessError } from '@/lib/claims';
import { CHAT_PER_HOUR, type ChatSender } from '@/lib/chat';
import { markRead, sendMessage, thread, type ChatMsg } from '@/lib/chat-db';
import { TOO_MANY, allow } from '@/lib/rate-limit';
import { getAdmin, getCustomer, getRestaurant } from '@/lib/session';

type Who = { as: ChatSender; id: string };

/** Quem está escrevendo: o cliente logado ou o dono (a administração em modo suporte só olha, não escreve). */
async function who(as: ChatSender, forWrite: boolean): Promise<Who | { error: string }> {
  if (as === 'CUSTOMER') {
    const c = await getCustomer();
    return c ? { as, id: c.id } : { error: 'Entre na sua conta.' };
  }
  const r = await getRestaurant();
  if (!r) return { error: 'Entre na sua conta.' };
  if (forWrite && (await getAdmin())) return { error: 'No modo suporte não dá para enviar mensagens como o lugar.' };
  return { as, id: r.id };
}

export type ChatResult = { ok: true; messages: ChatMsg[] } | { error: string };

/** Envia uma mensagem e devolve as novas (inclusive a enviada). */
export async function sendChat(as: ChatSender, conversationId: string, body: string, after?: string): Promise<ChatResult> {
  const w = await who(as, true);
  if ('error' in w) return w;
  if (!(await allow(`chat:${as}:${w.id}`, CHAT_PER_HOUR, 3600))) return { error: TOO_MANY };
  try {
    await sendMessage(conversationId, w.as, w.id, body);
    const messages = await thread(conversationId, w.as, w.id, after);
    revalidatePath(w.as === 'CUSTOMER' ? '/mensagens' : '/dashboard/mensagens');
    return { ok: true, messages };
  } catch (e) {
    if (e instanceof BusinessError) return { error: e.message };
    throw e;
  }
}

/** Busca o que chegou depois de `after` e marca como lido (a tela pergunta de tempos em tempos). */
export async function pollChat(as: ChatSender, conversationId: string, after?: string): Promise<ChatResult> {
  const w = await who(as, false);
  if ('error' in w) return w;
  try {
    const messages = await thread(conversationId, w.as, w.id, after);
    if (messages.some((m) => m.sender !== w.as)) await markRead(conversationId, w.as, w.id);
    return { ok: true, messages };
  } catch (e) {
    if (e instanceof BusinessError) return { error: e.message };
    throw e;
  }
}
