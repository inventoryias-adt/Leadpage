import { adminModerateReview } from '@/app/actions/reviews';
import { EmptyState } from '@/components/EmptyState';
import { Stars } from '@/components/Stars';
import { prisma } from '@/lib/db';
import { displayName } from '@/lib/reviews';

export const metadata = { title: 'Avaliações denunciadas' };
export const dynamic = 'force-dynamic';

const when = (d: Date) => d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });

export default async function AdminAvaliacoes() {
  const reviews = await prisma.review.findMany({
    where: { reportedAt: { not: null }, hiddenAt: null },
    orderBy: { reportedAt: 'asc' },
    take: 100,
    select: {
      id: true, placeRating: true, staffRating: true, comment: true, ownerReply: true, reportedAt: true, reportReason: true, createdAt: true,
      restaurant: { select: { name: true } }, customer: { select: { name: true } }, resource: { select: { name: true } },
    },
  });
  return (
    <div className="space-y-5">
      <section className="glass-panel p-5 sm:p-7">
        <h1 className="mb-1 text-xl font-semibold text-primary">Avaliações denunciadas</h1>
        <p className="text-sm text-slate-500">O dono do lugar denunciou estas avaliações. Ocultar remove do app e da nota; manter encerra a denúncia e a avaliação continua visível.</p>
      </section>
      {reviews.length === 0 ? (
        <EmptyState variant="users" title="Nenhuma denúncia pendente" text="Quando um dono denunciar uma avaliação, ela aparece aqui." />
      ) : (
        <ul className="space-y-3" data-testid="admin-reviews">
          {reviews.map((r) => (
            <li key={r.id} className="glass-panel space-y-2 p-4" data-testid="admin-review">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-slate-900">{r.restaurant.name}</p>
                <span className="text-xs text-slate-500">Denunciada em {r.reportedAt ? when(r.reportedAt) : ''}</span>
              </div>
              <p className="flex items-center gap-2 text-sm text-slate-700"><Stars value={r.placeRating} /> {displayName(r.customer.name)}{r.resource && r.staffRating ? <span className="text-xs text-slate-500">· atendente {r.resource.name}: {r.staffRating}★</span> : null}</p>
              {r.comment && <p className="text-sm text-slate-700">“{r.comment}”</p>}
              {r.ownerReply && <p className="text-xs text-slate-500">Resposta do lugar: {r.ownerReply}</p>}
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900"><b>Motivo da denúncia:</b> {r.reportReason}</p>
              <div className="flex flex-wrap gap-2">
                <form action={adminModerateReview}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="op" value="hide" />
                  <button className="glass-button btn-sm" data-testid="hide-review">Ocultar avaliação</button>
                </form>
                <form action={adminModerateReview}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="op" value="keep" />
                  <button className="glass-button-ghost btn-sm" data-testid="keep-review">Manter</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
