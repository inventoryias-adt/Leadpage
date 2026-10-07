'use client';

import { useActionState } from 'react';
import { FormMessage, SubmitButton } from '@/components/ui';
import type { FormState } from '@/lib/form';

export function ClaimForm({
  token,
  name,
  action,
}: {
  token: string;
  name: string;
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
}) {
  const [state, dispatch] = useActionState(action, {});
  return (
    <form action={dispatch} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <p className="text-center text-sm text-slate-600">Olá, {name}! Confirme para adicionar à sua carteira.</p>
      <FormMessage state={state} />
      <SubmitButton pendingText="Creditando…">Receber meus pontos</SubmitButton>
    </form>
  );
}
