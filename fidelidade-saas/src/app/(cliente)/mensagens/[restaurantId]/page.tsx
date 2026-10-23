import Link from 'next/link';
import { ChatThread } from '@/components/ChatThread';
import { PlaceAvatar } from '@/components/Visual';
import { BusinessError } from '@/lib/claims';
import { markRead, openConversation, thread } from '@/lib/chat-db';
import { prisma } from '@/lib/db';
import { imageUrl } from '@/lib/images';
import { requireCustomer } from '@/lib/session';

export const metadata = { title: 'Conversa' };
export const dynamic = 'force-dynamic';

export default async function ConversaPage({ params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params;
  const customer = await requireCustomer(`/mensagens/${restaurantId}`);
  const place = /^[0-9a-f-]{36}$/.test(restaurantId)
    ? await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true, name: true, logoImageId: true } })
    : null;
  let conversationId: string | null = null;
  let problem = place ? '' : 'Lugar não encontrado.';
  if (place) {
    try {
      conversationId = await openConversation(customer.id, place.id);
    } catch (e) {
      if (!(e instanceof BusinessError)) throw e;
      problem = 'Você só pode conversar com lugares onde já tem carteira.';
    }
  }
  const initial = conversationId ? await thread(conversationId, 'CUSTOMER', customer.id) : [];
  if (conversationId) await markRead(conversationId, 'CUSTOMER', customer.id);
  return (
    <main className="space-y-4 p-4 sm:p-6 md:pt-8">
      <header className="flex items-center gap-3">
        <Link href="/mensagens" aria-label="Voltar para Mensagens" className="text-2xl font-bold text-electric-600">‹</Link>
        {place && (
          <Link href={`/lugar/${place.id}`} className="flex min-w-0 items-center gap-3">
            <PlaceAvatar name={place.name} src={imageUrl(place.logoImageId)} size={40} />
            <h1 className="truncate text-lg font-extrabold text-primary" data-testid="chat-title">{place.name}</h1>
          </Link>
        )}
      </header>
      {conversationId && place ? (
        <div className="mx-auto w-full max-w-2xl"><ChatThread as="CUSTOMER" conversationId={conversationId} initial={initial} otherName={place.name} /></div>
      ) : (
        <p role="alert" className="glass-panel !rounded-[22px] p-5 text-center text-sm text-slate-600" data-testid="chat-blocked">{problem}</p>
      )}
    </main>
  );
}
