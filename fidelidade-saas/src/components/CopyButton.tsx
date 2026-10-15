'use client';

import { useState } from 'react';
import { Icon } from './Icons';

/** Botão que copia um texto (ex.: o @ do Instagram do lugar, para marcar na foto). Mostra "Copiado" por um instante. */
export function CopyButton({ text, label, copiedLabel = 'Copiado' }: { text: string; label: string; copiedLabel?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Sem permissão para a área de transferência (navegador antigo ou página sem HTTPS): mostra o texto para copiar à mão.
      window.prompt('Copie o texto:', text);
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  return (
    <button type="button" onClick={copy} className="glass-button btn-sm" aria-live="polite">
      <Icon name={copied ? 'check' : 'copy'} size={16} /> {copied ? copiedLabel : label}
    </button>
  );
}
