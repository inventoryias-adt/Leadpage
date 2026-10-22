import { replyReviewAction, reportReviewAction } from '@/app/actions/reviews';
import { EmptyState } from '@/components/EmptyState';
import { RatingBadge, Stars } from '@/components/Stars';
import { SubmitButton } from '@/components/ui';
import { prisma } from '@/lib/db';
import { COMMENT_MAX, MIN_REVIEWS_FOR_RANK, displayName, formatAvg, summarize } from '@/lib/reviews';
import { requireActiveRestaurant } from '@/lib/session';

export const metadata = { title: 'Avaliações' };
export const dynamic = 'force-dynamic';

const when = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short' });

export default async function AvaliacoesPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const restaurant = await requireActiveRestaurant();
  const sp = await searchParams;
  const reviews = await prisma.review.findMany({
    where: { restaurantId: restaurant.id, hiddenAt: null },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true, placeRating: true, staffRating: true, comment: true, ownerReply: true, reportedAt: true, createdAt: true,
      customer: { select: { name: true } }, resource: { select: { id: true, name: true } },
    },
  });
  const place = summarize(reviews.map((r) => r.placeRating));
  const staff = new Map<string, { name: string; ratings: number[] }>();
  for (const r of reviews) {
    if (!r.resource || !r.staffRating) continue;
    const cur = staff.get(r.resource.id) ?? { name: r.resource.name, ratings: [] };
    cur.ratings.push(r.staffRating);
    staff.set(r.resource.id, cur);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-primary">Avaliações</h1>
        <p className="text-sm text-slate-600">O que os clientes acharam dos atendimentos concluídos. Você pode responder e, se algo for ofensivo ou falso, denunciar para a administração analisar.</p>
      </header>

      {sp.ok && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700" data-testid="reviews-ok">{sp.ok}</p>}
      {sp.erro && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700" data-testid="reviews-erro">{sp.erro}</p>}

      <section className="glass-panel space-y-3 !rounded-[22px] p-4 sm:p-5" data-testid="reviews-summary">
        <h2 className="font-bold text-primary">Nota do seu negócio</h2>
        {place.count === 0 ? (
          <p className="text-sm text-slate-600">Ainda não há avaliações. Elas chegam depois que você conclui um atendimento na agenda.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-3xl font-extrabold text-primary">{formatAvg(place.avg ?? 0)}</span>
            <Stars value={place.avg ?? 0} size={22} />
            <span className="text-sm text-slate-600">{place.count} {place.count === 1 ? 'avaliação' : 'avaliações'}</span>
            {!place.ranked && <span className="text-xs text-slate-500">A nota só aparece para os clientes a partir de {MIN_REVIEWS_FOR_RANK} avaliações.</span>}
            {place.ranked && <RatingBadge summary={place} />}
          </div>
        )}
        {staff.size > 0 && (
          <div>
            <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">Por atendente</h3>
            <ul className="grid gap-2 sm:grid-cols-2" data-testid="reviews-staff">
              {[...staff.entries()].map(([id, s]) => {
                const sum = summarize(s.ratings);
                return (
                  <li key={id} className="glass-inset flex items-center justify-between gap-2 p-3 text-sm">
                    <span className="truncate font-semibold text-slate-800">{s.name}</span>
                    <span className="flex items-center gap-2"><Stars value={sum.avg ?? 0} size={14} /> <b>{formatAvg(sum.avg ?? 0)}</b> <span className="text-xs text-slate-500">({sum.count})</span></span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {reviews.length === 0 ? (
        <EmptyState variant="users" title="Nenhuma avaliação ainda" text="Quando o cliente avaliar um atendimento concluído, ela aparece aqui." />
      ) : (
        <ul className="space-y-3" data-testid="reviews-list">
          {reviews.map((r) => (
            <li key={r.id} className="glass-panel space-y-2 !rounded-[22px] p-4" data-testid="owner-review">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Stars value={r.placeRating} />
                  <span className="text-sm font-semibold text-slate-800">{displayName(r.customer.name)}</span>
                </div>
                <span className="text-xs text-slate-500">{when(r.createdAt)}</span>
              </div>
              {r.resource && r.staffRating && (
                <p className="flex items-center gap-2 text-xs text-slate-600">Atendente {r.resource.name}: <Stars value={r.staffRating} size={13} /></p>
              )}
              {r.comment && <p className="text-sm text-slate-700">“{r.comment}”</p>}
              {r.ownerReply && <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700"><b>Sua resposta:</b> {r.ownerReply}</p>}

              <details className="text-sm">
                <summary className="cursor-pointer font-semibold text-electric-600">{r.ownerReply ? 'Editar resposta' : 'Responder'}</summary>
                <form action={replyReviewAction} className="mt-2 space-y-2">
                  <input type="hidden" name="id" value={r.id} />
                  <textarea name="reply" required maxLength={COMMENT_MAX} rows={3} defaultValue={r.ownerReply ?? ''} className="glass-input" placeholder="Agradeça ou esclareça com educação" />
                  <SubmitButton className="btn-sm">Publicar resposta</SubmitButton>
                </form>
              </details>

              {r.reportedAt ? (
                <p className="text-xs font-semibold text-amber-700" data-testid="review-reported">Denunciada em {when(r.reportedAt)} — aguardando a administração.</p>
              ) : (
                <details className="text-sm">
                  <summary className="cursor-pointer text-slate-500">Denunciar esta avaliação</summary>
                  <form action={reportReviewAction} className="mt-2 space-y-2">
                    <input type="hidden" name="id" value={r.id} />
                    <textarea name="reason" required maxLength={300} rows={2} className="glass-input" placeholder="Por que ela deve ser analisada? (ofensa, não foi cliente, golpe…)" />
                    <SubmitButton variant="ghost" className="btn-sm">Enviar denúncia</SubmitButton>
                  </form>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
