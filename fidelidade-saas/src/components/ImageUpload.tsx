'use client';

import { useId, useState } from 'react';
import { Icon } from './Icons';
import { WebImageSearch, type WebImage } from './WebImageSearch';

/** Reduz a foto no navegador (lado máximo + WebP/JPEG) antes de enviar: carrega rápido e cabe no banco. */
export async function shrinkImage(file: File, maxSide: number): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const webp = canvas.toDataURL('image/webp', 0.82);
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.85);
}

export function ImageUpload({
  name,
  label,
  hint,
  currentUrl,
  maxSide = 640,
  shape = 'square',
  webSearch = false,
}: {
  name: string;
  label: string;
  hint?: string;
  currentUrl?: string | null;
  maxSide?: number;
  shape?: 'square' | 'wide';
  /** Mostra "Buscar na web": o dono acha a foto por nome ou código de barras. */
  webSearch?: boolean;
}) {
  const id = useId();
  const [data, setData] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [web, setWeb] = useState<WebImage | null>(null);
  const [searching, setSearching] = useState(false);
  const preview = data || web?.thumb || currentUrl || '';

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.');
      setData(await shrinkImage(file, maxSide));
      setWeb(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível ler a imagem.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <span className="glass-label">{label}</span>
      <div className="flex items-center gap-4">
        <div
          className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100 text-slate-400 ${
            shape === 'wide' ? 'h-20 w-36' : 'h-20 w-20'
          }`}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <Icon name="camera" size={26} />
          )}
        </div>
        <div className="min-w-0">
          <label htmlFor={id} className="glass-button-ghost btn-sm cursor-pointer">
            {busy ? 'Preparando…' : preview ? 'Trocar foto' : 'Escolher foto'}
          </label>
          <input id={id} type="file" accept="image/*" className="sr-only" onChange={onFile} />
          {webSearch && (
            <button type="button" className="glass-button-ghost btn-sm ml-2" onClick={() => setSearching((v) => !v)} aria-expanded={searching}>
              <Icon name="search" size={15} /> Buscar na web
            </button>
          )}
          {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
          {error && <p role="alert" className="mt-1.5 text-xs text-red-600">{error}</p>}
        </div>
      </div>
      <input type="hidden" name={name} value={data} />
      {webSearch && <input type="hidden" name="imageWebUrl" value={web?.image ?? ''} />}
      {webSearch && searching && (
        <WebImageSearch
          onChoose={(item) => {
            setWeb(item);
            setData('');
            setSearching(false);
          }}
        />
      )}
    </div>
  );
}
