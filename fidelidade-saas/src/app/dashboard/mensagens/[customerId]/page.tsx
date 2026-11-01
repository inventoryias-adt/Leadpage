import { Icon } from '@/components/Icons';
import Link from 'next/link';
import { ChatThread } from '@/components/ChatThread';
import { displayName } from '@/lib/reviews';
import { BusinessError } from '@/lib/claims';
import { markRead, openConversation, thread } from '@/lib/chat-db';
import { prisma } from '@/lib/db';
import { getAdmin, requireActiveRestaurant } from '@/lib/session';

export const metadata = { title: 'Conversa' };
export const dynamic = 'force-dynamic';

export default async function ConversaDono({ params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await params;
  const restaurant = await requireActiveRestaurant();
  const customer = /^[0-9a-f-]{36}$/.test(customerId) ? await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true, name: true } }) : null;
  let conversationId: string | null = null;
  let problem = customer ? '' : 'Cliente não encontrado.';
  if (customer) {
    try {
      conversationId = await openConversation(customer.id, restaurant.id);
    } catch (e) {
      if (!(e instanceof BusinessError)) throw e;
      problem = 'Você só conversa com clientes que têm carteira no seu negócio.';
    }
  }
  const initial = conversationId ? await thread(conversationId, 'RESTAURANT', restaurant.id) : [];
  if (conversationId && !(await getAdmin())) await markRead(conversationId, 'RESTAURANT', restaurant.id);
  const name = customer ? displayName(customer.name) : '';
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header className="flex items-center gap-3">
        <Link href="/dashboard/mensagens" aria-label="Voltar para Mensagens" className="glass-button-ghost btn-sm shrink-0 !gap-1" data-testid="owner-back"><Icon name="back" size={16} /> Mensagens</Link>
        <h1 className="truncate text-lg font-extrabold text-primary" data-testid="chat-title">{name}</h1>
      </header>
      {conversationId ? (
        <ChatThread as="RESTAURANT" conversationId={conversationId} initial={initial} otherName={name} />
      ) : (
        <p role="alert" className="glass-panel !rounded-[22px] p-5 text-center text-sm text-slate-600" data-testid="chat-blocked">{problem}</p>
      )}
    </div>
  );
}
