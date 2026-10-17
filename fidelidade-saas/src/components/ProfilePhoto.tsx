'use client';

import { useActionState, useEffect, useId, useRef, useState } from 'react';
import { removeProfilePhoto, saveProfilePhoto } from '@/app/actions/customer';
import type { FormState } from '@/lib/form';
import { Icon } from './Icons';
import { shrinkImage } from './ImageUpload';

/**
 * Avatar do perfil com a troca de foto: toque no avatar (ou na câmera), escolha a foto e ela já é enviada,
 * reduzida no próprio celular. Sem foto, mostra a inicial do nome. `children` é o texto ao lado (nome e CPF).
 */
export function ProfilePhoto({ name, photoUrl, children }: { name: string; photoUrl: string | null; children: React.ReactNode }) {
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<FormState, FormData>(saveProfilePhoto, {});
  const [data, setData] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Assim que a foto reduzida fica pronta, envia o formulário.
  useEffect(() => {
    if (!data) return;
    form.current?.requestSubmit(); // o React lê o formulário na hora do envio, então já dá para zerar
    setData('');
  }, [data]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    input.value = ''; // permite escolher a mesma foto de novo
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.');
      setData(await shrinkImage(file, 480));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível ler a imagem.');
    } finally {
      setBusy(false);
    }
  }

  const working = busy || pending;
  const message = error || state.error;
  const label = photoUrl ? 'Trocar foto de perfil' : 'Adicionar foto de perfil';

  return (
    <div className="mt-5 flex items-center gap-4">
      <form ref={form} action={action} autoComplete="off" className="relative shrink-0">
        <label htmlFor={id} className="block cursor-pointer" aria-label={label}>
          <span
            className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg text-2xl font-semibold text-white"
            style={{ background: '#0F1F3D' }}
          >
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="Sua foto de perfil" className="h-full w-full object-cover" data-testid="profile-photo" />
            ) : (
              <span aria-hidden>{name.trim().charAt(0).toUpperCase()}</span>
            )}
          </span>
          <span className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-electric-600 text-white shadow-sm">
            <Icon name="camera" size={14} />
          </span>
        </label>
        <input id={id} type="file" accept="image/*" className="sr-only" onChange={onFile} data-testid="profile-photo-input" />
        <input type="hidden" name="photoData" value={data} />
      </form>

      <div className="min-w-0">
        {children}
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs" role="status" aria-live="polite">
          {working ? (
            <span className="text-slate-500">Enviando foto…</span>
          ) : message ? (
            <span role="alert" className="text-red-600">{message}</span>
          ) : (
            <label htmlFor={id} className="link-inline cursor-pointer font-semibold">{photoUrl ? 'Trocar foto' : 'Adicionar foto'}</label>
          )}
          {photoUrl && !working && (
            <button type="button" className="font-medium text-slate-500 underline-offset-2 hover:underline" onClick={() => void removeProfilePhoto()}>
              Remover
            </button>
          )}
        </p>
      </div>
    </div>
  );
}
