import { EmptyState } from '@/components/EmptyState';
import { OwnerPostReport } from '@/components/OwnerPostReport';
import { Stars } from '@/components/Stars';
import { prisma } from '@/lib/db';
import { authorName, postPhotoPath } from '@/lib/posts';
import { requireActiveRestaurant } from '@/lib/session';

export const metadata = { title: 'Indicações dos clientes' };
export const dynamic = 'force-dynamic';

const when = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short' });

export default async function IndicacoesDono() {
  const restaurant = await requireActiveRestaurant();
  const posts = await prisma.post.findMany({
    where: { restaurantId: restaurant.id, hiddenAt: null },
    orderBy: { createdAt: 'desc' },
    take: 60,
    select: { id: true, rating: true, comment: true, reportedAt: true, createdAt: true, customer: { select: { name: true, instagram: true } }, _count: { select: { likes: true } } },
  });
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-primary">Indicações dos clientes</h1>
        <p className="text-sm text-slate-600">Fotos e comentários que seus clientes postaram sobre o seu lugar. Se algo for ofensivo ou não for do seu negócio, denuncie para a administração analisar.</p>
      </header>
      {posts.length === 0 ? (
        <EmptyState variant="users" title="Nenhuma indicação ainda" text="Quando um cliente seu postar uma foto na aba Indicações do aplicativo, ela aparece aqui." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2" data-testid="owner-posts">
          {posts.map((p) => (
            <li key={p.id} className="glass-panel overflow-hidden !rounded-[22px]" data-testid="owner-post">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={postPhotoPath(p.id)} alt="Foto da indicação" loading="lazy" className="aspect-[4/3] w-full bg-slate-100 object-cover" />
              <div className="space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Stars value={p.rating} size={16} /> {authorName(p.customer.name)}</span>
                  <span className="text-xs text-slate-500">{when(p.createdAt)} · ♥ {p._count.likes}</span>
                </div>
                {p.comment && <p className="text-sm text-slate-700">“{p.comment}”</p>}
                <OwnerPostReport postId={p.id} reported={p.reportedAt != null} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
