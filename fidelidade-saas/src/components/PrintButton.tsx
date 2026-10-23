'use client';

import { Icon } from './Icons';

/** Abre a janela de impressão do navegador (o CSS de impressão mostra só o que a página marcou para imprimir). */
export function PrintButton({ label = 'Imprimir' }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="glass-button !w-auto px-6" data-testid="print-now">
      <Icon name="receipt" size={18} /> {label}
    </button>
  );
}
