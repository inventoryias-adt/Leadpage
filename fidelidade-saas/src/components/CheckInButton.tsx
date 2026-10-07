'use client';

import { startTransition, useActionState, useState } from 'react';
import { checkInAction } from '@/app/actions/customer';
import { Icon } from './Icons';

/** Pede a localização ao navegador e manda para o servidor conferir a distância até o restaurante. */
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
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const fd = new FormData();
        fd.set('restaurantId', restaurantId);
        fd.set('lat', String(pos.coords.latitude));
        fd.set('lng', String(pos.coords.longitude));
        startTransition(() => action(fd)); // transição mantém o estado "pending" do botão
      },
      (err) => {
        setLocating(false);
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? 'Permissão de localização negada. Libere nas configurações do navegador para fazer check-in.'
            : 'Não foi possível obter sua localização. Tente de novo.',
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10_000 },
    );
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
