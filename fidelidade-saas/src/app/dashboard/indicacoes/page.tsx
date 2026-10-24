import { EmptyState } from '@/components/EmptyState';
import { OwnerPostReport } from '@/components/OwnerPostReport';
import { ReviewTabs } from '@/components/ReviewTabs';
import { Stars } from '@/components/Stars';
import { prisma } from '@/lib/db';
import { authorName, postPhotoPath } from '@/lib/posts';
import { formatAvg, summarize } from '@/lib/reviews';
import { getAdmin, requireActiveRestaurant } from '@/lib/session';

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
  const [reviewCount, all] = await Promise.all([
    prisma.review.count({ where: { restaurantId: restaurant.id, hiddenAt: null } }),
    prisma.post.findMany({ where: { restaurantId: restaurant.id, hiddenAt: null }, select: { rating: true, _count: { select: { likes: true } } } }),
  ]);
  const seenAt = restaurant.postsSeenAt;
  if (!(await getAdmin())) await prisma.restaurant.update({ where: { id: restaurant.id }, data: { postsSeenAt: new Date() } });
  const summary = summarize(all.map((p) => p.rating));
  const likes = all.reduce((n, p) => n + p._count.likes, 0);
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-primary">Avaliações</h1>
        <p className="text-sm text-slate-600">Fotos e notas que seus clientes postaram marcando o seu lugar. Se algo for ofensivo ou não for do seu negócio, denuncie para a administração analisar.</p>
      </header>
      <ReviewTabs active="indicacoes" services={reviewCount} posts={all.length} />
      {summary.count > 0 && (
        <section className="glass-panel flex flex-wrap items-center gap-3 !rounded-[22px] p-4 sm:p-5" data-testid="posts-summary">
          <span className="text-3xl font-extrabold text-primary">{formatAvg(summary.avg ?? 0)}</span>
          <Stars value={summary.avg ?? 0} size={22} />
          <span className="text-sm text-slate-600">{summary.count} {summary.count === 1 ? 'indicação' : 'indicações'} · ♥ {likes}</span>
          <span className="text-xs text-slate-500">Esta nota é só das fotos postadas pelos clientes. Ela não entra na nota dos atendimentos.</span>
        </section>
      )}
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
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Stars value={p.rating} size={16} /> {authorName(p.customer.name)}{p.createdAt > seenAt && <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[11px] font-bold text-rose-700" data-testid="post-new">Nova</span>}</span>
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
