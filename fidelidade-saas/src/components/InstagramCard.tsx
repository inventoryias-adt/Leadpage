'use client';

import { useActionState } from 'react';
import { saveInstagram } from '@/app/actions/posts';
import { instagramUrl } from '@/lib/posts';
import { Icon } from './Icons';
import { FormMessage, SubmitButton } from './ui';

/** Perfil: o @ do Instagram do cliente (opcional). Aparece nas indicações e abre o perfil; o botão abre o Instagram para publicar. */
export function InstagramCard({ handle }: { handle: string | null }) {
  const [state, action] = useActionState(saveInstagram, {});
  const shown = state.values?.instagram ?? handle ?? '';
  return (
    <section aria-labelledby="instagram" className="glass-panel-sm space-y-3 p-4" data-testid="instagram-card">
      <div className="flex items-start gap-3">
        <span className="icon-tile shrink-0"><Icon name="camera" size={20} /></span>
        <div className="min-w-0">
          <h2 id="instagram" className="font-bold text-slate-800">Seu Instagram</h2>
          <p className="text-xs text-slate-500">Opcional. Seu @ aparece nas suas indicações e quem gostar abre o seu perfil. Para publicar no Instagram, toque em &ldquo;Publicar no Instagram&rdquo; na indicação.</p>
        </div>
      </div>
      <form action={action} className="flex items-start gap-2" autoComplete="off">
        <div className="min-w-0 flex-1">
          <label htmlFor="ig-handle" className="sr-only">Seu @ do Instagram</label>
          <div className="relative">
            <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-semibold text-slate-400">@</span>
            <input id="ig-handle" name="instagram" defaultValue={shown} maxLength={40} placeholder="seu.usuario" className="glass-input !pl-8" autoCapitalize="none" autoCorrect="off" />
          </div>
        </div>
        <SubmitButton pendingText="Salvando…" className="btn-sm !w-auto shrink-0 px-5" data-testid="save-instagram">Salvar</SubmitButton>
      </form>
      <FormMessage state={state} />
      {handle && (
        <a href={instagramUrl(handle)} target="_blank" rel="noopener noreferrer" className="glass-button-ghost btn-sm" data-testid="open-instagram"><Icon name="share" size={16} /> Abrir @{handle} no Instagram</a>
      )}
    </section>
  );
}
