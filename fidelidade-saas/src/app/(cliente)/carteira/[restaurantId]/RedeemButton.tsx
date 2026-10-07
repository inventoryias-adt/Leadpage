'use client';

import { useActionState, useState } from 'react';
import { redeemRewardAction } from '@/app/actions/customer';

/** Dois toques (Resgatar → Confirmar) para evitar gasto acidental de pontos. */
export function RedeemButton({ rewardId, name, disabled }: { rewardId: string; name: string; disabled: boolean }) {
  const [state, action, pending] = useActionState(redeemRewardAction, {});
  const [confirming, setConfirming] = useState(false);

  if (state.ok) return <p className="max-w-[9rem] text-right text-xs font-semibold text-emerald-600">{state.ok}</p>;

  return (
    <form action={action} className="shrink-0 text-right">
      <input type="hidden" name="rewardId" value={rewardId} />
      {confirming ? (
        <div className="flex gap-1.5">
          <button type="button" onClick={() => setConfirming(false)} className="glass-button-ghost btn-sm">
            Não
          </button>
          <button type="submit" disabled={pending} className="glass-button btn-sm">
            {pending ? '…' : 'Confirmar'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setConfirming(true)}
          aria-label={`Resgatar ${name}`}
          className="glass-button btn-sm"
        >
          Resgatar
        </button>
      )}
      {state.error && <p role="alert" className="mt-1 max-w-[10rem] text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
