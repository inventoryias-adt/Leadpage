'use client';

import { useActionState } from 'react';
import { submitReviewAction } from '@/app/actions/reviews';
import { StarPicker } from './StarPicker';
import { SubmitButton } from './ui';
import { COMMENT_MAX } from '@/lib/reviews';

/** Formulário de avaliação: lugar, quem atendeu (se houve) e comentário. */
export function ReviewForm({ bookingId, placeName, staffName }: { bookingId: string; placeName: string; staffName: string | null }) {
  const [state, action] = useActionState(submitReviewAction, {});
  return (
    <form action={action} className="glass-panel space-y-5 p-5" data-testid="review-form">
      <input type="hidden" name="bookingId" value={bookingId} />
      <StarPicker name="placeRating" label={`Como foi em ${placeName}?`} defaultValue={Number(state.values?.placeRating) || 0} />
      {staffName && <StarPicker name="staffRating" label={`E o atendimento de ${staffName}?`} optional defaultValue={Number(state.values?.staffRating) || 0} />}
      <div>
        <label htmlFor="rv-comment" className="glass-label">Quer contar mais? <span className="font-normal text-slate-500">(opcional)</span></label>
        <textarea id="rv-comment" name="comment" rows={4} maxLength={COMMENT_MAX} defaultValue={state.values?.comment ?? ''} placeholder="O que você mais gostou? O que poderia melhorar?" className="glass-input" />
        <p className="mt-1 text-xs text-slate-500">Aparece com o seu primeiro nome e a inicial do sobrenome. Seja respeitoso.</p>
      </div>
      {state.error && <p role="alert" className="glass-error">{state.error}</p>}
      <SubmitButton pendingText="Enviando…">Enviar avaliação</SubmitButton>
    </form>
  );
}
