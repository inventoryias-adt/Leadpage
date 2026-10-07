'use client';

import { useState } from 'react';
import { Icon } from './Icons';

/** Copiar link e enviar por WhatsApp (o link de convite é montado no servidor com o domínio correto). */
export function ShareButtons({ url, text }: { url: string; text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt('Copie o link:', url);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <a href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`} target="_blank" rel="noopener noreferrer" className="glass-button btn-sm">
        <Icon name="whatsapp" size={16} /> Enviar no WhatsApp
      </a>
      <button type="button" onClick={copy} className="glass-button-ghost btn-sm">
        <Icon name={copied ? 'check' : 'copy'} size={16} /> {copied ? 'Link copiado' : 'Copiar link'}
      </button>
    </div>
  );
}
