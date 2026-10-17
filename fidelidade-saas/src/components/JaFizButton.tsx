'use client';

import { useActionState } from 'react';
import { requestInteractionAction } from '@/app/actions/customer';
import { FormMessage, SubmitButton } from './ui';

/** "Já fiz": pede ao lugar os pontos de uma interação (Google, Instagram…). Mostra na hora que o pedido foi enviado. */
export function JaFizButton({ ruleId, restaurantId }: { ruleId: string; restaurantId: string }) {
  const [state, action] = useActionState(requestInteractionAction, {});
  if (state.ok) return <p role="status" className="glass-success !py-2 text-sm">{state.ok}</p>;
  return (
    <form action={action} autoComplete="off" className="space-y-2">
      <input type="hidden" name="ruleId" value={ruleId} />
      <input type="hidden" name="restaurantId" value={restaurantId} />
      <SubmitButton variant="navy" pendingText="Enviando…" className="btn-sm">Já fiz</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
