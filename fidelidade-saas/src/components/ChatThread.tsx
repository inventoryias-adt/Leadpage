'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { pollChat, sendChat } from '@/app/actions/chat';
import { CHAT_MAX, chatTime, type ChatSender } from '@/lib/chat';
import type { ChatMsg } from '@/lib/chat-db';

const POLL_MS = 5000;

/** Conversa: balões (meus à direita), envio por Enter, e busca de novidades a cada poucos segundos enquanto a tela está aberta. */
export function ChatThread({ as, conversationId, initial, otherName }: { as: ChatSender; conversationId: string; initial: ChatMsg[]; otherName: string }) {
  const [messages, setMessages] = useState<ChatMsg[]>(initial);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  const last = useRef<string | undefined>(initial.at(-1)?.createdAt);

  const merge = useCallback((incoming: ChatMsg[]) => {
    if (!incoming.length) return;
    setMessages((cur) => {
      const seen = new Set(cur.map((m) => m.id));
      const add = incoming.filter((m) => !seen.has(m.id));
      return add.length ? [...cur, ...add] : cur;
    });
    last.current = incoming.at(-1)?.createdAt ?? last.current;
  }, []);

  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [messages.length]);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      if (stop || document.visibilityState !== 'visible') return;
      const r = await pollChat(as, conversationId, last.current).catch(() => null);
      if (!stop && r && 'ok' in r) merge(r.messages);
    };
    const id = window.setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => { stop = true; window.clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, [as, conversationId, merge]);

  const send = () => {
    const body = text.trim();
    if (!body || pending) return;
    setError('');
    start(async () => {
      const r = await sendChat(as, conversationId, body, last.current);
      if ('error' in r) { setError(r.error); return; }
      setText('');
      merge(r.messages);
    });
  };

  return (
    <div className="flex flex-col gap-3" data-testid="chat">
      <div ref={box} className="h-[calc(100dvh-19rem)] min-h-[300px] space-y-2 overflow-y-auto rounded-3xl bg-slate-50 p-3" role="log" aria-live="polite" aria-label={`Conversa com ${otherName}`} data-testid="chat-messages">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-slate-500" data-testid="chat-empty">Nenhuma mensagem ainda. Escreva a primeira.</p>}
        {messages.map((m) => {
          const mine = m.sender === as;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`} data-testid={mine ? 'msg-mine' : 'msg-theirs'}>
              <div className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${mine ? 'rounded-br-md bg-[#0F1F3D] text-white' : 'rounded-bl-md bg-white text-slate-800'}`}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`mt-0.5 text-right text-[10px] ${mine ? 'text-white/60' : 'text-slate-400'}`}>{chatTime(new Date(m.createdAt))}</p>
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={1}
          maxLength={CHAT_MAX}
          placeholder="Escreva uma mensagem"
          aria-label="Mensagem"
          className="glass-input max-h-32 min-h-[44px] flex-1 resize-none"
          data-testid="chat-input"
        />
        <button type="submit" disabled={pending || !text.trim()} className="glass-button-lime btn-sm !w-auto" data-testid="chat-send">Enviar</button>
      </form>
      {error && <p role="alert" className="text-xs font-semibold text-rose-600" data-testid="chat-error">{error}</p>}
    </div>
  );
}
