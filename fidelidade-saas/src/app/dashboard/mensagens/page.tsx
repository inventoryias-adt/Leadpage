import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState';
import { chatTime, preview } from '@/lib/chat';
import { conversations } from '@/lib/chat-db';
import { requireActiveRestaurant } from '@/lib/session';

export const metadata = { title: 'Mensagens' };
export const dynamic = 'force-dynamic';

export default async function MensagensDono() {
  const restaurant = await requireActiveRestaurant();
  const list = await conversations('RESTAURANT', restaurant.id);
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-primary">Mensagens</h1>
        <p className="text-sm text-slate-600">Conversas com os seus clientes. Para começar uma, abra o cliente em Clientes e toque em Conversar.</p>
      </header>
      {list.length === 0 ? (
        <EmptyState variant="users" title="Nenhuma conversa ainda" text="Quando um cliente escrever para você, a conversa aparece aqui. Você também pode começar uma pela lista de Clientes." />
      ) : (
        <ul className="glass-panel divide-y divide-slate-100 !rounded-[22px] overflow-hidden" data-testid="chat-list">
          {list.map((c) => (
            <li key={c.id}>
              <Link href={`/dashboard/mensagens/${c.other.id}`} className="card-link flex items-center gap-3 px-4 py-3" data-testid="chat-row">
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-bold text-slate-900">{c.other.name}</span>
                    <span className="shrink-0 text-xs text-slate-500">{chatTime(c.lastMessageAt)}</span>
                  </span>
                  <span className={`block truncate text-sm ${c.unread ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>{c.last ? `${c.last.sender === 'RESTAURANT' ? 'Você: ' : ''}${preview(c.last.body)}` : ''}</span>
                </span>
                {c.unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-rose-500" aria-label="Mensagem nova" data-testid="chat-unread" />}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
