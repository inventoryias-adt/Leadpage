'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Atualiza a página sozinha de tempos em tempos (só com a aba aberta), para a lista de horários acompanhar quem fecha na hora. */
export function LiveRefresh({ everyMs = 20_000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, everyMs);
    return () => clearInterval(id);
  }, [router, everyMs]);
  return null;
}
