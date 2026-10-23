import { adminModeratePost } from '@/app/actions/posts';
import { EmptyState } from '@/components/EmptyState';
import { Stars } from '@/components/Stars';
import { prisma } from '@/lib/db';
import { authorName, postPhotoPath } from '@/lib/posts';

export const metadata = { title: 'Indicações denunciadas' };
export const dynamic = 'force-dynamic';

const when = (d: Date) => d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });

export default async function AdminIndicacoes() {
  const posts = await prisma.post.findMany({
    where: { reportedAt: { not: null }, hiddenAt: null },
    orderBy: { reportedAt: 'asc' },
    take: 100,
    select: {
      id: true, rating: true, comment: true, reportedAt: true, createdAt: true,
      restaurant: { select: { name: true } },
      customer: { select: { name: true, instagram: true } },
      reports: { orderBy: { createdAt: 'asc' }, select: { id: true, reason: true, reporterCustomerId: true, reporterRestaurantId: true } },
    },
  });
  return (
    <div className="space-y-5">
      <section className="glass-panel p-5 sm:p-7">
        <h1 className="mb-1 text-xl font-semibold text-primary">Indicações denunciadas</h1>
        <p className="text-sm text-slate-500">Clientes e donos de lugares denunciaram estas indicações. Esconder tira do feed (só quem postou ainda vê, marcada); manter encerra as denúncias e a indicação continua visível.</p>
      </section>
      {posts.length === 0 ? (
        <EmptyState variant="users" title="Nenhuma denúncia pendente" text="Quando alguém denunciar uma indicação, ela aparece aqui." />
      ) : (
        <ul className="space-y-3" data-testid="admin-posts">
          {posts.map((p) => (
            <li key={p.id} className="glass-panel flex flex-col gap-3 p-4 sm:flex-row" data-testid="admin-post">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={postPhotoPath(p.id)} alt="Foto da indicação" className="h-40 w-full rounded-2xl bg-slate-100 object-cover sm:h-36 sm:w-36" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{p.restaurant.name}</p>
                  <span className="text-xs text-slate-500">Denunciada em {p.reportedAt ? when(p.reportedAt) : ''}</span>
                </div>
                <p className="flex items-center gap-2 text-sm text-slate-700"><Stars value={p.rating} /> {authorName(p.customer.name)}{p.customer.instagram ? <span className="text-xs text-slate-500">@{p.customer.instagram}</span> : null}</p>
                {p.comment && <p className="text-sm text-slate-700">“{p.comment}”</p>}
                <ul className="space-y-1">
                  {p.reports.map((r) => (
                    <li key={r.id} className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900"><b>{r.reporterRestaurantId ? 'Dono do lugar' : 'Cliente'}:</b> {r.reason}</li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  <form action={adminModeratePost}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="op" value="hide" />
                    <button className="glass-button btn-sm" data-testid="hide-post">Esconder indicação</button>
                  </form>
                  <form action={adminModeratePost}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="op" value="keep" />
                    <button className="glass-button-ghost btn-sm" data-testid="keep-post">Manter</button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
