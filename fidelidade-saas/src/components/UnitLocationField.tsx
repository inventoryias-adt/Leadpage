'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { cepDigits, maskCep } from '@/lib/address';
import { parseReverse, placeLine } from '@/lib/customer-location';
import { Icon } from './Icons';
import type { MapTarget } from './LocationMap';

const LocationMap = dynamic(() => import('./LocationMap'), { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-slate-100" /> });

const NOMINATIM = 'https://nominatim.openstreetmap.org';

type Coords = { lat: string; lng: string };
type Addr = { cep: string; street: string; number: string; city: string; state: string };

/**
 * Onde fica a unidade: o dono vê um mapa com o pino e o endereço por extenso (nada de latitude/longitude).
 * Pode usar o GPS (estando na unidade), achar pelo endereço digitado e arrastar o mapa para acertar a porta.
 */
export function UnitLocationField({ coords, setCoords, addr }: { coords: Coords; setCoords: (c: Coords) => void; addr: Addr }) {
  const has = !!coords.lat && !!coords.lng;
  const [target, setTarget] = useState<MapTarget | null>(has ? { lat: Number(coords.lat), lng: Number(coords.lng), zoom: 18, nonce: 0 } : null);
  const [place, setPlace] = useState<string | null>(null);
  const [placeBusy, setPlaceBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'idle' | 'gps' | 'addr' | 'error'; msg?: string }>({ kind: 'idle' });
  const [source, setSource] = useState<'saved' | 'gps' | 'addr' | 'drag' | null>(has ? 'saved' : null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  // Endereço por extenso do ponto do pino (com pausa para não consultar a cada arrasto).
  function describe(lat: number, lng: number) {
    setPlaceBusy(true);
    if (timer.current) clearTimeout(timer.current);
    const mine = ++seq.current;
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(`${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=pt-BR&lat=${lat}&lon=${lng}`);
        const g = parseReverse(await r.json());
        if (mine === seq.current) setPlace(g ? placeLine(g) || null : null);
      } catch {
        if (mine === seq.current) setPlace(null);
      } finally {
        if (mine === seq.current) setPlaceBusy(false);
      }
    }, 500);
  }

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function point(lat: number, lng: number, from: 'gps' | 'addr') {
    setCoords({ lat: lat.toFixed(6), lng: lng.toFixed(6) });
    setTarget((t) => ({ lat, lng, zoom: 18, nonce: (t?.nonce ?? 0) + 1 }));
    setSource(from);
  }

  function moved(c: { lat: number; lng: number }) {
    const lat = c.lat.toFixed(6), lng = c.lng.toFixed(6);
    if (lat !== coords.lat || lng !== coords.lng) {
      setCoords({ lat, lng });
      setSource('drag');
    }
    describe(c.lat, c.lng);
  }

  function useGps() {
    if (!('geolocation' in navigator)) return setStatus({ kind: 'error', msg: 'Seu navegador não permite obter a localização. Use “Achar pelo endereço”.' });
    setStatus({ kind: 'gps' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        point(pos.coords.latitude, pos.coords.longitude, 'gps');
        setStatus({ kind: 'idle' });
      },
      (err) =>
        setStatus({
          kind: 'error',
          msg: err.code === err.PERMISSION_DENIED ? 'Permissão negada. Libere a localização no navegador ou use “Achar pelo endereço”.' : 'Não foi possível obter a localização. Tente de novo.',
        }),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  async function byAddress() {
    setStatus({ kind: 'addr' });
    const base = `${NOMINATIM}/search?format=jsonv2&limit=1&countrycodes=br&accept-language=pt-BR`;
    const attempts = [
      `${base}&street=${encodeURIComponent(`${addr.number} ${addr.street}`.trim())}&city=${encodeURIComponent(addr.city)}&state=${encodeURIComponent(addr.state)}`,
      `${base}&street=${encodeURIComponent(addr.street)}&city=${encodeURIComponent(addr.city)}&state=${encodeURIComponent(addr.state)}`,
      ...(cepDigits(addr.cep).length === 8 ? [`${base}&postalcode=${encodeURIComponent(maskCep(addr.cep))}`] : []),
    ];
    try {
      for (const url of attempts) {
        const hits = (await (await fetch(url)).json()) as { lat: string; lon: string }[];
        if (hits[0]) {
          point(Number(hits[0].lat), Number(hits[0].lon), 'addr');
          setStatus({ kind: 'idle' });
          return;
        }
      }
      setStatus({ kind: 'error', msg: 'Não encontramos esse endereço no mapa. Confira rua e cidade ou use o GPS dentro da unidade.' });
    } catch {
      setStatus({ kind: 'error', msg: 'Não foi possível consultar o mapa agora. Tente de novo ou use o GPS.' });
    }
  }

  const canAddr = !!addr.street.trim() && !!addr.city.trim() && !!addr.state;
  const busy = status.kind === 'gps' || status.kind === 'addr';

  return (
    <div className="glass-inset space-y-3 p-4">
      <div className="flex items-start gap-3">
        <Icon name="pin" className="mt-0.5 shrink-0 text-electric-600" />
        <div className="min-w-0">
          <p className="font-semibold text-slate-800">Localização no mapa</p>
          <p className="text-xs text-slate-500">Usada no check-in (o cliente precisa estar a até 200 m) e para a unidade aparecer em “Lugares perto de você”.</p>
        </div>
      </div>

      {target ? (
        <>
          <div className="relative h-48 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 sm:h-56">
            <LocationMap target={target} onMove={moved} />
            <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-full text-electric-600 drop-shadow-lg">
              <Icon name="pin" size={36} strokeWidth={2.2} />
            </span>
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2">
            <Icon name="check" size={16} className="mt-0.5 shrink-0 text-emerald-600" />
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-slate-800" aria-live="polite">
                {placeBusy ? <span className="text-slate-400">Buscando o endereço do pino…</span> : place || 'Ponto marcado no mapa'}
              </p>
              <p className="text-xs text-slate-500">
                {source === 'addr'
                  ? 'Achado pelo endereço (aproximado). Arraste o mapa até o pino ficar na porta da unidade.'
                  : source === 'gps'
                    ? 'Marcado pelo GPS. Se precisar, arraste o mapa para ajustar.'
                    : 'Arraste o mapa para ajustar o pino na porta da unidade.'}
              </p>
            </div>
          </div>
        </>
      ) : (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4 text-center text-sm text-slate-500">
          Ainda não marcada. Escolha uma das opções abaixo.
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={useGps} disabled={busy} className="glass-button-ghost !py-2.5">
          <Icon name="pin" size={16} /> {status.kind === 'gps' ? 'Obtendo localização…' : 'Estou na unidade (GPS)'}
        </button>
        <button type="button" onClick={byAddress} disabled={busy || !canAddr} className="glass-button-ghost !py-2.5">
          <Icon name="search" size={16} /> {status.kind === 'addr' ? 'Procurando…' : 'Achar pelo endereço'}
        </button>
      </div>
      {!canAddr && !target && <p className="text-xs text-slate-500">Para achar pelo endereço, preencha rua, cidade e UF acima.</p>}
      {status.kind === 'error' && <p role="alert" className="text-xs text-red-600">{status.msg}</p>}
    </div>
  );
}
