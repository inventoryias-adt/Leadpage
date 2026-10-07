'use client';

import { useEffect } from 'react';
import { markNotificationsRead } from '@/app/actions/avisos';

/** Ao abrir a tela de avisos, marca tudo como lido (depois de um instante, para dar tempo de ver o que é novo). */
export function MarkRead() {
  useEffect(() => {
    const t = setTimeout(() => void markNotificationsRead(), 2000);
    return () => clearTimeout(t);
  }, []);
  return null;
}
