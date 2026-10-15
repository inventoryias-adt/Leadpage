'use client';

import { startTransition, useActionState, useState } from 'react';
import { checkInAction } from '@/app/actions/customer';
import { Icon } from './Icons';

const GOOD_ACCURACY_M = 12; // leitura boa: não precisa esperar mais
const WEAK_ACCURACY_M = 50; // pior que isso: pede para tentar de novo em vez de enviar
const MAX_WAIT_MS = 10_000;

/** Pede a localização ao navegador (a melhor leitura em até 10 s) e manda para o servidor conferir se a pessoa está no local. */
export function CheckInButton({ restaurantId, points }: { restaurantId: string; points: number }) {
  const [state, action, pending] = useActionState(checkInAction, {});
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState('');

  function go() {
    setGeoError('');
    if (!('geolocation' in navigator)) {
      setGeoError('Seu navegador não permite obter a localização.');
      return;
    }
    setLocating(true);

    // O raio do check-in é curto, então uma leitura só costuma vir imprecisa: acompanha o GPS por até 10 s
    // e usa a melhor leitura (para cedo se já estiver boa). Com sinal fraco, orienta em vez de acusar "você não está aqui".
    let best: GeolocationPosition | null = null;
    let finished = false;
    let timer: ReturnType<typeof setTimeout>;
    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        if (!best || pos.coords.accuracy < best.coords.accuracy) best = pos;
        if (pos.coords.accuracy <= GOOD_ACCURACY_M) done();
      },
      (err) => {
        if (best) return done();
        finish();
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? 'Permissão de localização negada. Libere nas configurações do navegador para fazer check-in.'
            : 'Não foi possível obter sua localização. Tente de novo.',
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
    timer = setTimeout(done, MAX_WAIT_MS);

    function finish() {
      finished = true;
      clearTimeout(timer);
      navigator.geolocation.clearWatch(watch);
      setLocating(false);
    }

    function done() {
      if (finished) return;
      finish();
      const pos = best as GeolocationPosition | null;
      if (!pos) return setGeoError('Não foi possível obter sua localização. Tente de novo.');
      if (pos.coords.accuracy > WEAK_ACCURACY_M) {
        return setGeoError('Sinal de GPS fraco. Vá para perto de uma janela ou da porta, espere alguns segundos e tente de novo.');
      }
      const fd = new FormData();
      fd.set('restaurantId', restaurantId);
      fd.set('lat', String(pos.coords.latitude));
      fd.set('lng', String(pos.coords.longitude));
      startTransition(() => action(fd)); // transição mantém o estado "pending" do botão
    }
  }

  const busy = locating || pending;
  return (
    <div>
      <button type="button" onClick={go} disabled={busy} className="glass-button btn-sm">
        <Icon name="pin" size={16} />
        {locating ? 'Buscando você…' : pending ? 'Confirmando…' : `Fazer check-in (+${points} ${points === 1 ? 'ponto' : 'pontos'})`}
      </button>
      {state.ok && <p role="status" className="glass-success mt-2">{state.ok}</p>}
      {(state.error || geoError) && <p role="alert" className="glass-error mt-2">{state.error || geoError}</p>}
    </div>
  );
}
