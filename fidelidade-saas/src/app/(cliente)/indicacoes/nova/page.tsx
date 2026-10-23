import Link from 'next/link';
import { Brand } from '@/components/Brand';
import { NewPostForm } from '@/components/NewPostForm';
import { eligiblePlaces } from '@/lib/posts-db';
import { requireCustomer } from '@/lib/session';

export const metadata = { title: 'Nova indicação' };
export const dynamic = 'force-dynamic';

export default async function NovaIndicacaoPage({ searchParams }: { searchParams: Promise<{ lugar?: string }> }) {
  const customer = await requireCustomer('/indicacoes/nova');
  const places = await eligiblePlaces(customer.id);
  const { lugar } = await searchParams;
  return (
    <main className="space-y-5 p-4 sm:p-6 md:pt-8">
      <header>
        <div className="md:hidden"><Brand href="/carteira" /></div>
        <Link href="/indicacoes" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-electric-600 md:mt-0">‹ Indicações</Link>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-primary">Nova indicação</h1>
        <p className="text-sm text-slate-600">Mostre o que você gostou num lugar do clube: uma foto, a sua nota e, se quiser, um comentário.</p>
      </header>
      <div className="mx-auto w-full max-w-md">
        {places.length === 0 ? (
          <div className="glass-panel space-y-3 !rounded-[22px] p-6 text-center" data-testid="no-places">
            <p className="text-lg font-extrabold text-primary">Você ainda não tem carteira em nenhum lugar</p>
            <p className="text-sm text-slate-600">As indicações são de lugares onde você já ganhou pontos. Depois da primeira compra, a carteira aparece e você pode indicar.</p>
            <Link href="/lugares" className="glass-button !w-auto px-6">Explorar lugares</Link>
          </div>
        ) : (
          <NewPostForm places={places.map((p) => ({ id: p.id, name: p.name }))} defaultPlace={places.find((p) => p.id === lugar)?.id} />
        )}
      </div>
    </main>
  );
}
