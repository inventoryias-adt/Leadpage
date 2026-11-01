import Link from 'next/link';
import { Brand } from '@/components/Brand';
import { Icon } from '@/components/Icons';
import { PostCard, type PostCardData } from '@/components/PostCard';
import { prisma } from '@/lib/db';
import { feed } from '@/lib/posts-db';
import { requireCustomer } from '@/lib/session';

export const metadata = { title: 'Indicações' };
export const dynamic = 'force-dynamic';

const ID = /^[0-9a-f-]{36}$/;

export default async function IndicacoesPage({ searchParams }: { searchParams: Promise<{ publicada?: string; lugar?: string; minhas?: string; antes?: string }> }) {
  const customer = await requireCustomer('/indicacoes');
  const sp = await searchParams;
  const mine = sp.minhas === '1';
  const place = sp.lugar && ID.test(sp.lugar) ? await prisma.restaurant.findUnique({ where: { id: sp.lugar }, select: { id: true, name: true } }) : null;
  const before = sp.antes && !Number.isNaN(Date.parse(sp.antes)) ? new Date(sp.antes) : undefined;
  const { posts, nextBefore } = await feed(customer.id, { mine, restaurantId: place?.id, before });
  const data: PostCardData[] = posts.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() }));
  const href = (extra: Record<string, string>) => `/indicacoes?${new URLSearchParams({ ...(mine ? { minhas: '1' } : {}), ...(place ? { lugar: place.id } : {}), ...extra }).toString()}`;

  return (
    <main className="space-y-5 p-4 sm:p-6 md:pt-8">
      <header>
        <div className="md:hidden"><Brand href="/carteira" /></div>
        <div className="mt-5 flex items-end justify-between gap-3 md:mt-0">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-primary">Indicações</h1>
            <p className="text-sm text-slate-600">Fotos e notas de quem frequenta os lugares do clube.</p>
          </div>
          <Link href={place ? `/indicacoes/nova?lugar=${place.id}` : '/indicacoes/nova'} className="glass-button-lime btn-sm shrink-0" data-testid="nova-indicacao"><Icon name="plus" size={16} /> Indicar</Link>
        </div>
      </header>

      {sp.publicada && <p role="status" className="glass-success" data-testid="publicada">Indicação publicada! Que tal publicar também no seu Instagram?</p>}

      <nav aria-label="Filtro" className="chip-row">
        <Link href="/indicacoes" aria-current={!mine && !place ? 'true' : undefined} className={`chip-link shrink-0 ${!mine && !place ? 'chip-link-active' : ''}`}>Todas</Link>
        <Link href="/indicacoes?minhas=1" aria-current={mine ? 'true' : undefined} className={`chip-link shrink-0 ${mine ? 'chip-link-active' : ''}`}>Minhas</Link>
        {place && <Link href="/indicacoes" aria-current="true" className="chip-link chip-link-active shrink-0">{place.name} ✕</Link>}
      </nav>

      {data.length === 0 ? (
        <div className="glass-panel flex flex-col items-center gap-3 !rounded-[22px] p-8 text-center" data-testid="feed-empty">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E8EEFB] text-electric-600"><Icon name="camera" size={26} /></span>
          <p className="text-lg font-extrabold text-primary">{mine ? 'Você ainda não indicou nenhum lugar' : 'Ainda não há indicações'}</p>
          <p className="max-w-xs text-sm text-slate-600">Poste a foto de um prato, de um corte ou do que você gostou, com a sua nota. Vale para os lugares onde você já tem carteira.</p>
          <Link href="/indicacoes/nova" className="glass-button-lime !w-auto">Fazer a primeira indicação</Link>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-md space-y-5" data-testid="feed">
          {data.map((p) => <PostCard key={p.id} post={p} highlight={p.id === sp.publicada} viewerInstagram={customer.instagram} />)}
          {nextBefore && <Link href={href({ antes: nextBefore.toISOString() })} className="glass-button-ghost" data-testid="feed-more">Ver mais</Link>}
        </div>
      )}
    </main>
  );
}
