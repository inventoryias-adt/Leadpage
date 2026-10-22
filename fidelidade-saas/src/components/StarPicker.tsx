'use client';

import { useState } from 'react';

const WORDS = ['', 'Ruim', 'Pode melhorar', 'Bom', 'Muito bom', 'Excelente'];

/** Escolha de 1 a 5 estrelas (botões grandes para o toque). Manda o valor num campo escondido com o nome dado. */
export function StarPicker({ name, label, defaultValue = 0, optional = false }: { name: string; label: string; defaultValue?: number; optional?: boolean }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <fieldset className="space-y-1.5" data-testid={`stars-${name}`}>
      <legend className="glass-label">{label}{optional && <span className="font-normal text-slate-500"> (opcional)</span>}</legend>
      <input type="hidden" name={name} value={value || ''} />
      <div className="flex items-center gap-1" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={value === i}
            aria-label={`${i} ${i === 1 ? 'estrela' : 'estrelas'}`}
            onClick={() => setValue(optional && value === i ? 0 : i)}
            className={`flex h-12 w-12 items-center justify-center rounded-xl text-3xl transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-electric-600 ${i <= value ? 'text-amber-400' : 'text-slate-300'}`}
          >
            ★
          </button>
        ))}
        <span className="ml-2 min-w-24 text-sm font-semibold text-slate-600" aria-live="polite">{WORDS[value] ?? ''}</span>
      </div>
    </fieldset>
  );
}
