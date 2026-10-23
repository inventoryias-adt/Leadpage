import Link from 'next/link';
import { Brand } from '@/components/Brand';
import { EmptyState } from '@/components/EmptyState';
import { PlaceAvatar } from '@/components/Visual';
import { chatTime, preview } from '@/lib/chat';
import { conversations } from '@/lib/chat-db';
import { imageUrl } from '@/lib/images';
import { requireCustomer } from '@/lib/session';

export const metadata = { title: 'Mensagens' };
export const dynamic = 'force-dynamic';

export default async function MensagensPage() {
  const customer = await requireCustomer('/mensagens');
  const list = await conversations('CUSTOMER', customer.id);
  return (
    <main className="space-y-5 p-4 sm:p-6 md:pt-8">
      <header>
        <div className="md:hidden"><Brand href="/carteira" /></div>
        <Link href="/perfil" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-electric-600 md:mt-0">‹ Perfil</Link>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-primary">Mensagens</h1>
        <p className="text-sm text-slate-600">Suas conversas com os lugares. Para começar uma, abra o lugar e toque em Conversar.</p>
      </header>
      {list.length === 0 ? (
        <EmptyState variant="users" title="Nenhuma conversa ainda" text="Abra um lugar onde você tem carteira e toque em Conversar para falar com ele." />
      ) : (
        <ul className="glass-panel divide-y divide-slate-100 !rounded-[22px] overflow-hidden" data-testid="chat-list">
          {list.map((c) => (
            <li key={c.id}>
              <Link href={`/mensagens/${c.other.id}`} className="card-link flex items-center gap-3 px-4 py-3" data-testid="chat-row">
                <PlaceAvatar name={c.other.name} src={imageUrl(c.other.logoImageId)} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-bold text-slate-900">{c.other.name}</span>
                    <span className="shrink-0 text-xs text-slate-500">{chatTime(c.lastMessageAt)}</span>
                  </span>
                  <span className={`block truncate text-sm ${c.unread ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>{c.last ? `${c.last.sender === 'CUSTOMER' ? 'Você: ' : ''}${preview(c.last.body)}` : ''}</span>
                </span>
                {c.unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-rose-500" aria-label="Mensagem nova" data-testid="chat-unread" />}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
