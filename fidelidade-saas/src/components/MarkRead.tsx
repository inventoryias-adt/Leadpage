'use client';

import { useEffect } from 'react';
import { markNotificationsRead } from '@/app/actions/avisos';

/** Ao abrir a tela de avisos, marca como lido o que está na tela (depois de um instante, para dar tempo de ver o que é novo). */
export function MarkRead({ restaurantId }: { restaurantId?: string }) {
  useEffect(() => {
    const t = setTimeout(() => void markNotificationsRead(restaurantId), 2000);
    return () => clearTimeout(t);
  }, [restaurantId]);
  return null;
}
