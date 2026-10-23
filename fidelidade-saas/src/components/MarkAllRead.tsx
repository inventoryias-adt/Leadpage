'use client';

import { useState } from 'react';
import { markNotificationsRead } from '@/app/actions/avisos';

/** "Marcar tudo como lido": para quem não quer abrir dia por dia. Com `restaurantId`, só os daquele lugar (a tela filtrada). */
export function MarkAllRead({ restaurantId }: { restaurantId?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void markNotificationsRead(restaurantId).finally(() => setBusy(false));
      }}
      className="!bg-transparent !p-0 text-sm font-semibold text-electric-600 !shadow-none hover:underline disabled:opacity-50"
      data-testid="mark-all-read"
    >
      Marcar tudo como lido
    </button>
  );
}
