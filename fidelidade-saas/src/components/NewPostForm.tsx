'use client';

import { useActionState, useId, useState } from 'react';
import { publishPost } from '@/app/actions/posts';
import { Icon } from './Icons';
import { shrinkImage } from './ImageUpload';
import { StarPicker } from './StarPicker';
import { FormMessage, SubmitButton } from './ui';
import { POST_COMMENT_MAX } from '@/lib/posts';

/** Formulário da nova indicação: lugar, foto (reduzida no celular), nota e comentário. */
export function NewPostForm({ places, defaultPlace }: { places: { id: string; name: string }[]; defaultPlace?: string }) {
  const photoId = useId();
  const [state, action] = useActionState(publishPost, {});
  const [photo, setPhoto] = useState('');
  const [busy, setBusy] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const v = state.values;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setPhotoError('');
    setBusy(true);
    try {
      if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.');
      setPhoto(await shrinkImage(file, 1080));
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Não foi possível ler a imagem.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form action={action} autoComplete="off" className="glass-panel space-y-5 !rounded-[22px] p-4 sm:p-5" data-testid="new-post-form">
      <input type="hidden" name="photoData" value={photo} />

      <div>
        <label htmlFor={photoId} className="glass-label">Foto</label>
        <label
          htmlFor={photoId}
          className="relative flex aspect-[4/5] w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 transition-colors hover:border-electric-500"
          data-testid="photo-drop"
        >
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="Prévia da foto da indicação" className="absolute inset-0 h-full w-full object-cover" data-testid="photo-preview" />
          ) : (
            <span className="flex flex-col items-center gap-2 px-6 text-center text-sm font-semibold">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E8EEFB] text-electric-600"><Icon name="camera" size={26} /></span>
              {busy ? 'Preparando a foto…' : 'Toque para tirar ou escolher uma foto'}
            </span>
          )}
        </label>
        <input id={photoId} type="file" accept="image/*" className="sr-only" onChange={onFile} data-testid="post-photo-input" />
        {photo && <label htmlFor={photoId} className="link-inline mt-1.5 inline-block cursor-pointer text-sm font-semibold">Trocar foto</label>}
        {photoError && <p role="alert" className="glass-error mt-2">{photoError}</p>}
      </div>

      <div>
        <label htmlFor="np-place" className="glass-label">Qual lugar?</label>
        <select id="np-place" name="restaurantId" className="glass-input" defaultValue={v?.restaurantId ?? defaultPlace ?? places[0]?.id}>
          {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <StarPicker name="rating" label="Sua nota" defaultValue={Number(v?.rating) || 0} />

      <div>
        <label htmlFor="np-comment" className="glass-label">Conte como foi <span className="font-normal text-slate-500">(opcional)</span></label>
        <textarea id="np-comment" name="comment" rows={3} maxLength={POST_COMMENT_MAX} defaultValue={v?.comment ?? ''} placeholder="O prato, o corte, o atendimento… o que você quer indicar?" className="glass-input" />
        <p className="mt-1 text-xs text-slate-500">Aparece com o seu primeiro nome e a inicial do sobrenome. Seja respeitoso e só poste fotos suas, sem expor outras pessoas.</p>
      </div>

      <FormMessage state={state} />
      <SubmitButton pendingText="Publicando…" variant="lime" data-testid="publish-post">Publicar indicação</SubmitButton>
    </form>
  );
}
