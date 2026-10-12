'use client';

import { useEffect, useState } from 'react';
import type { SavedAddress } from '@/app/actions/location';
import { CHOSEN_KEY, parseChosen, type Chosen } from '@/lib/customer-location';
import { Icon } from './Icons';
import { LocationPicker } from './LocationPicker';

/**
 * Faixa "Onde está?" no topo da vitrine. Guarda a escolha no aparelho (localStorage) e avisa a vitrine,
 * que ordena os lugares por distância. Se o cliente já liberou o GPS antes e ainda não escolheu nada, usa o GPS direto.
 */
export function LocationBar({ saved, loggedIn, onChange }: { saved: SavedAddress[]; loggedIn: boolean; onChange: (c: Chosen | null) => void }) {
  const [chosen, setChosen] = useState<Chosen | null>(null);
  const [open, setOpen] = useState(false);

  const apply = (c: Chosen | null) => {
    setChosen(c);
    onChange(c);
    try {
      if (c) localStorage.setItem(CHOSEN_KEY, JSON.stringify(c));
      else localStorage.removeItem(CHOSEN_KEY);
    } catch {}
  };

  useEffect(() => {
    let stored: Chosen | null = null;
    try {
      stored = parseChosen(localStorage.getItem(CHOSEN_KEY));
    } catch {}
    // Um endereço salvo que foi apagado (em outro aparelho) deixa de valer.
    if (stored?.kind === 'saved' && !saved.some((s) => s.id === stored!.id)) stored = null;
    if (stored) return void (setChosen(stored), onChange(stored));
    navigator.permissions?.query({ name: 'geolocation' }).then((r) => {
      if (r.state !== 'granted') return;
      navigator.geolocation.getCurrentPosition(
        (p) => apply({ kind: 'gps', lat: p.coords.latitude, lng: p.coords.longitude, title: 'Minha localização' }),
        () => {},
        { timeout: 12000, maximumAge: 120_000 },
      );
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={chosen ? `Localização: ${chosen.title}. Trocar` : 'Onde está? Escolher localização'} className="flex w-full min-w-0 items-center gap-2 !bg-transparent !p-0 text-left !shadow-none">
        <Icon name="pin" size={20} className="shrink-0 text-electric-600" />
        <span className="min-w-0">
          <span className="block truncate text-base font-extrabold text-slate-900" data-testid="loc-title">{chosen ? chosen.title : 'Onde está?'}</span>
          {chosen?.sub && <span className="block truncate text-xs text-slate-500">{chosen.sub}</span>}
        </span>
        <Icon name="down" size={16} className="shrink-0 text-slate-500" />
      </button>
      {open && (
        <LocationPicker
          saved={saved}
          loggedIn={loggedIn}
          current={chosen}
          onChoose={(c) => {
            apply(c);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
