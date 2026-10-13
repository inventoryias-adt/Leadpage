'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { deleteMyAddress, saveMyAddress, type SavedAddress } from '@/app/actions/location';
import { cepDigits, maskCep, parseViaCep } from '@/lib/address';
import { ADDRESS_LABELS, ADDRESS_LABEL_TEXT, DEFAULT_CENTER, MAX_SAVED_ADDRESSES, inBrazil, parseReverse, placeLine, type AddressLabel, type Chosen, type Guessed } from '@/lib/customer-location';
import { Icon } from './Icons';
import type { MapTarget } from './LocationMap';

const LocationMap = dynamic(() => import('./LocationMap'), { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-slate-100" /> });

type Step = 'home' | 'map' | 'details';
const NOMINATIM = 'https://nominatim.openstreetmap.org';

async function reverse(lat: number, lng: number): Promise<Guessed | null> {
  try {
    const r = await fetch(`${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=pt-BR&lat=${lat}&lon=${lng}`);
    return parseReverse(await r.json());
  } catch {
    return null;
  }
}

const labelIcon = (l: string) => (l === 'CASA' ? 'home' : l === 'TRABALHO' ? 'bag' : 'pin') as 'home' | 'bag' | 'pin';

/**
 * "Onde você tá?": endereços salvos, minha localização (GPS) e marcar no mapa (com CEP, número, complemento e rótulo).
 * Tela cheia no celular, janela centralizada no computador.
 */
export function LocationPicker({
  saved: initialSaved,
  loggedIn,
  current,
  onChoose,
  onClose,
}: {
  saved: SavedAddress[];
  loggedIn: boolean;
  current: Chosen | null;
  onChoose: (c: Chosen) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>('home');
  const [saved, setSaved] = useState(initialSaved);
  const [gps, setGps] = useState<'idle' | 'loading' | 'denied' | 'error'>('idle');
  const [center, setCenter] = useState(current ? { lat: current.lat, lng: current.lng } : DEFAULT_CENTER);
  const [target, setTarget] = useState<MapTarget>({ ...(current ?? DEFAULT_CENTER), zoom: current ? 17 : 13, nonce: 0 });
  const [guess, setGuess] = useState<Guessed | null>(null);
  const [guessing, setGuessing] = useState(false);
  const [showCep, setShowCep] = useState(false);
  const [cep, setCep] = useState('');
  const [cepMsg, setCepMsg] = useState<string | null>(null);
  const [form, setForm] = useState({ street: '', number: '', complement: '', semNumero: false, label: 'CASA' as AddressLabel });
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  // Cada parada do mapa vira uma consulta de endereço (com pausa para não consultar a cada arrasto).
  function moved(c: { lat: number; lng: number }) {
    setCenter(c);
    setGuessing(true);
    if (timer.current) clearTimeout(timer.current);
    const mine = ++seq.current;
    timer.current = setTimeout(async () => {
      const g = await reverse(c.lat, c.lng);
      if (mine !== seq.current) return;
      setGuess(g);
      setGuessing(false);
    }, 600);
  }

  function useGps() {
    if (!('geolocation' in navigator)) return setGps('error');
    setGps('loading');
    // O tempo do navegador só conta depois da permissão; se a pessoa ignorar o aviso, não deixamos o botão preso.
    let settled = false;
    const giveUp = setTimeout(() => !settled && setGps('error'), 15_000);
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        if (settled) return;
        settled = true;
        clearTimeout(giveUp);
        const lat = p.coords.latitude, lng = p.coords.longitude;
        if (!inBrazil(lat, lng)) return setGps('error');
        const g = await reverse(lat, lng);
        onChoose({ kind: 'gps', lat, lng, title: 'Minha localização', sub: g ? placeLine(g) : undefined });
      },
      (err) => {
        settled = true;
        clearTimeout(giveUp);
        setGps(err.code === err.PERMISSION_DENIED ? 'denied' : 'error');
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 120_000 },
    );
  }

  function openMap() {
    setStep('map');
    // Sem endereço anterior, tenta começar perto de onde o aparelho está (sem insistir se negar).
    if (!current && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (p) => inBrazil(p.coords.latitude, p.coords.longitude) && setTarget((t) => ({ lat: p.coords.latitude, lng: p.coords.longitude, zoom: 17, nonce: t.nonce + 1 })),
        () => {},
        { timeout: 6000, maximumAge: 300_000 },
      );
    }
  }

  async function lookupCep() {
    const d = cepDigits(cep);
    if (d.length !== 8) return setCepMsg('Digite os 8 números do CEP.');
    setCepMsg('Buscando…');
    try {
      const found = parseViaCep(await (await fetch(`https://viacep.com.br/ws/${d}/json/`)).json());
      if (!found) return setCepMsg('CEP não encontrado.');
      const base = `${NOMINATIM}/search?format=jsonv2&limit=1&countrycodes=br&accept-language=pt-BR`;
      const tries = [`${base}&street=${encodeURIComponent(found.street)}&city=${encodeURIComponent(found.city)}&state=${encodeURIComponent(found.state)}`, `${base}&postalcode=${encodeURIComponent(maskCep(d))}`];
      for (const url of tries) {
        const hits = (await (await fetch(url)).json()) as { lat: string; lon: string }[];
        if (hits[0] && inBrazil(Number(hits[0].lat), Number(hits[0].lon))) {
          setTarget((t) => ({ lat: Number(hits[0].lat), lng: Number(hits[0].lon), zoom: 17, nonce: t.nonce + 1 }));
          setCepMsg(null);
          setShowCep(false);
          return;
        }
      }
      setCepMsg('Achamos o CEP, mas não o ponto no mapa. Arraste o mapa até o seu endereço.');
    } catch {
      setCepMsg('Não foi possível consultar o CEP agora. Arraste o mapa até o seu ponto.');
    }
  }

  function toDetails() {
    setForm((f) => ({ ...f, street: guess?.street ?? f.street }));
    setError(null);
    setStep('details');
  }

  const numberText = form.semNumero ? 'S/N' : form.number.trim();
  const draft = () => ({
    label: form.label, street: form.street.trim(), number: numberText, complement: form.complement.trim(),
    district: guess?.district ?? '', city: guess?.city ?? '', state: guess?.state ?? '', cep: guess?.cep ?? '',
    lat: String(center.lat), lng: String(center.lng),
  });

  function chooseDraft() {
    const d = draft();
    onChoose({ kind: 'map', lat: center.lat, lng: center.lng, title: d.street || 'Ponto no mapa', sub: [d.number, d.district || d.city].filter(Boolean).join(' · ') });
  }

  function save() {
    setError(null);
    if (!form.street.trim()) return setError('Informe a rua.');
    if (!numberText) return setError('Informe o número ou marque “Sem número”.');
    if (!guess?.city || !guess?.state) return setError('Não identificamos a cidade deste ponto. Mova o mapa um pouco e tente de novo.');
    startSave(async () => {
      const res = await saveMyAddress(draft());
      if (!res.ok) return setError(res.error);
      setSaved((s) => [res.address, ...s.filter((x) => x.id !== res.address.id && !(x.label === res.address.label && res.address.label !== 'OUTRO'))]);
      onChoose({ kind: 'saved', id: res.address.id, lat: res.address.lat, lng: res.address.lng, title: res.address.title, sub: res.address.sub });
    });
  }

  async function remove(id: string) {
    const r = await deleteMyAddress(id);
    if (r.ok) setSaved((s) => s.filter((x) => x.id !== id));
  }

  const back = (to: Step | 'close') => (
    <button type="button" onClick={() => (to === 'close' ? onClose() : setStep(to))} aria-label="Voltar" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200">
      <Icon name="back" size={20} />
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-900/50 md:items-center md:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Escolher localização" onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-lg flex-col overflow-hidden bg-white md:h-[min(46rem,92vh)] md:rounded-3xl md:shadow-2xl">
        {step === 'home' && (
          <div className="flex-1 overflow-y-auto p-5">
            <div className="mb-5 flex items-center gap-3">{back('close')}<h2 className="text-2xl font-extrabold tracking-tight text-primary">Onde você tá?</h2></div>
            <p className="mb-5 text-sm text-slate-600">Mostramos o que tem perto e a distância de cada lugar.</p>

            {saved.length > 0 && (
              <ul className="mb-5 space-y-2" aria-label="Seus endereços">
                {saved.map((a) => (
                  <li key={a.id} className="flex items-center gap-2">
                    <button type="button" onClick={() => onChoose({ kind: 'saved', id: a.id, lat: a.lat, lng: a.lng, title: a.title, sub: a.sub })} className={`glass-panel-sm flex min-w-0 flex-1 items-center gap-3 p-3 text-left ${current?.id === a.id ? 'ring-2 ring-electric-500' : ''}`}>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E8EEFB] text-electric-600"><Icon name={labelIcon(a.label)} size={20} /></span>
                      <span className="min-w-0"><span className="block font-bold text-slate-800">{a.title}</span><span className="block truncate text-xs text-slate-500">{a.sub}</span></span>
                    </button>
                    <button type="button" onClick={() => remove(a.id)} aria-label={`Apagar endereço ${a.title}`} className="shrink-0 rounded-lg px-2 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-red-600">Apagar</button>
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-3">
              <button type="button" onClick={useGps} disabled={gps === 'loading'} className="glass-button">{gps === 'loading' ? 'Buscando sua localização…' : 'Minha localização'}</button>
              <button type="button" onClick={openMap} className="glass-button-ghost">Marcar no mapa</button>
              {gps === 'denied' && <p role="alert" className="text-sm text-red-600">Localização bloqueada. Libere no navegador ou marque o ponto no mapa.</p>}
              {gps === 'error' && <p role="alert" className="text-sm text-red-600">Não foi possível obter a localização. Tente de novo ou marque no mapa.</p>}
              {!loggedIn && (
                <p className="text-xs text-slate-500">
                  <Link href="/entrar?next=/lugares" className="link-inline">Entre na sua conta</Link> para salvar Casa e Trabalho e usar em qualquer aparelho. Até {MAX_SAVED_ADDRESSES} endereços.
                </p>
              )}
            </div>
          </div>
        )}

        {step === 'map' && (
          <>
            <div className="p-5 pb-3">
              <div className="mb-3 flex items-center gap-3">{back('home')}<h2 className="text-2xl font-extrabold tracking-tight text-primary">Marcar no mapa</h2></div>
              <p className="text-sm text-slate-600">
                Arraste até o seu ponto.{' '}
                <button type="button" onClick={() => setShowCep((v) => !v)} className="link-inline" aria-expanded={showCep}>usar CEP</button>
              </p>
              {showCep && (
                <div className="mt-3 flex gap-2">
                  <label className="sr-only" htmlFor="loc-cep">CEP</label>
                  <input id="loc-cep" inputMode="numeric" autoComplete="postal-code" value={cep} onChange={(e) => setCep(maskCep(e.target.value))} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), lookupCep())} placeholder="00000-000" className="glass-input" />
                  <button type="button" onClick={lookupCep} className="glass-button !w-auto shrink-0">Buscar</button>
                </div>
              )}
              {cepMsg && <p role="status" className="mt-2 text-xs text-slate-600">{cepMsg}</p>}
            </div>
            <div className="relative mx-5 min-h-0 flex-1 overflow-hidden rounded-2xl">
              <LocationMap target={target} onMove={moved} />
              <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-full text-electric-600 drop-shadow-lg"><Icon name="pin" size={40} strokeWidth={2.2} /></span>
            </div>
            <div className="space-y-3 p-5">
              <p className="min-h-[1.5rem] truncate text-base font-bold text-slate-800" data-testid="guess" aria-live="polite">
                {guessing ? <span className="text-slate-400">Buscando endereço…</span> : guess ? placeLine(guess) || 'Endereço sem nome' : 'Não identificamos o endereço. Você pode seguir assim.'}
              </p>
              <button type="button" onClick={toDetails} disabled={guessing} className="glass-button">Confirmar endereço</button>
            </div>
          </>
        )}

        {step === 'details' && (
          <div className="flex-1 overflow-y-auto p-5">
            <div className="mb-3 flex items-center gap-3">{back('map')}<h2 className="text-2xl font-extrabold tracking-tight text-primary">Qual o número?</h2></div>
            <p className="mb-4 flex items-center gap-2 text-sm text-slate-600">
              <Icon name="pin" size={16} className="shrink-0 text-electric-600" />
              <span className="min-w-0 flex-1 truncate">{guess ? placeLine(guess) : 'Ponto no mapa'}</span>
              <button type="button" onClick={() => setStep('map')} className="link-inline shrink-0">Ajustar</button>
            </p>
            <div className="space-y-3">
              <div>
                <label className="glass-label" htmlFor="loc-street">Rua</label>
                <input id="loc-street" value={form.street} onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))} className="glass-input" maxLength={120} autoComplete="off" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="glass-label" htmlFor="loc-number">Número</label>
                  <input id="loc-number" value={form.semNumero ? '' : form.number} disabled={form.semNumero} onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))} placeholder={form.semNumero ? 'S/N' : 'Número'} className="glass-input" maxLength={12} inputMode="numeric" autoComplete="off" />
                </div>
                <div>
                  <label className="glass-label" htmlFor="loc-comp">Complemento</label>
                  <input id="loc-comp" value={form.complement} onChange={(e) => setForm((f) => ({ ...f, complement: e.target.value }))} placeholder="Apto, bloco…" className="glass-input" maxLength={60} autoComplete="off" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.semNumero} onChange={(e) => setForm((f) => ({ ...f, semNumero: e.target.checked }))} className="h-4 w-4 rounded accent-electric-500" /> Sem número
              </label>
              <div role="radiogroup" aria-label="Tipo de endereço" className="flex flex-wrap gap-2">
                {ADDRESS_LABELS.map((l) => (
                  <button key={l} type="button" role="radio" aria-checked={form.label === l} onClick={() => setForm((f) => ({ ...f, label: l }))} className={`!w-auto !rounded-full !px-5 !py-2 !text-sm !font-bold uppercase tracking-wide ${form.label === l ? 'glass-button' : 'glass-button-ghost'}`}>
                    {ADDRESS_LABEL_TEXT[l]}
                  </button>
                ))}
              </div>
              {error && <p role="alert" className="glass-error">{error}</p>}
              {loggedIn ? (
                <button type="button" onClick={save} disabled={saving} className="glass-button">{saving ? 'Salvando…' : 'Salvar endereço'}</button>
              ) : (
                <p className="text-xs text-slate-500"><Link href="/entrar?next=/lugares" className="link-inline">Entre na sua conta</Link> para salvar este endereço.</p>
              )}
              <button type="button" onClick={chooseDraft} className="glass-button-ghost">Usar sem salvar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
