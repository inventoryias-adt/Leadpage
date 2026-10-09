'use client';

import { useState } from 'react';
import { Icon } from './Icons';

export type WebImage = { code: string; name: string; brand: string; thumb: string; image: string; alt?: string };

/** Busca fotos de produtos por nome ou código de barras e deixa o dono escolher uma. */
export function WebImageSearch({ onChoose, initialQuery = '' }: { onChoose: (item: WebImage) => void; initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery);
  const [items, setItems] = useState<WebImage[] | null>(null);
  const [error, setError] = useState('');
  const [partial, setPartial] = useState(false);
  const [loading, setLoading] = useState(false);

  async function search() {
    const term = q.trim();
    if (term.length < 2) {
      setError('Digite o nome ou o código de barras do produto.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/imagens/buscar?q=${encodeURIComponent(term)}`);
      const json = (await res.json()) as { items?: WebImage[]; error?: string; partial?: boolean };
      if (!res.ok) throw new Error(json.error ?? 'Não foi possível buscar agora.');
      setItems(json.items ?? []);
      setPartial(Boolean(json.partial));
    } catch (e) {
      setItems(null);
      setError(e instanceof Error ? e.message : 'Não foi possível buscar agora.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-white p-3">
      <div>
        <p className="text-sm font-semibold text-slate-800">Busque a foto do produto de duas formas</p>
        <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
          <li><span className="font-semibold">Pelo nome:</span> digite como no rótulo, ex.: <em>Coca-Cola 350 ml</em></li>
          <li><span className="font-semibold">Pelo código de barras:</span> digite os números (EAN), ex.: <em>7894900011517</em></li>
        </ul>
      </div>
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault(); // não envia o formulário do produto
              void search();
            }
          }}
          className="glass-input"
          placeholder="Nome ou código de barras"
          aria-label="Buscar foto do produto na web"
          maxLength={60}
        />
        <button type="button" className="glass-button btn-sm shrink-0" onClick={() => void search()} disabled={loading}>
          <Icon name="search" size={15} /> {loading ? 'Buscando…' : 'Buscar'}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {items && items.length === 0 && (
        <p className="text-sm text-slate-600">{partial ? 'Nenhuma foto encontrada, mas uma das fontes está instável agora. Tente de novo em instantes. ' : 'Nenhuma foto encontrada. '} Confira o código ou tente outro nome. Se for um prato da casa, envie a foto do seu computador.</p>
      )}
      {items && items.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Fotos encontradas">
          {items.map((it) => (
            <li key={it.image}>
              <button type="button" onClick={() => onChoose(it)} className="card-link flex h-full w-full flex-col items-center gap-1 rounded-lg border border-slate-200 bg-white p-2 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.thumb} alt="" loading="lazy" className="h-20 w-full object-contain" />
                <span className="line-clamp-2 text-[11px] font-medium leading-tight text-slate-700">{it.name}</span>
                {it.brand && <span className="text-[10px] text-slate-500">{it.brand}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-slate-500">Damos preferência às fotos da Bluesoft (fundo branco); se não houver, usamos o Open Food Facts. Funciona melhor com produtos embalados e bebidas.</p>
    </div>
  );
}
