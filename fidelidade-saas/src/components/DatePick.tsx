'use client';

import { useRouter } from 'next/navigation';

/** Campo "Outra data": ao escolher o dia a tela troca sozinha, sem recarregar o app (um formulário comum reabria o app no celular). */
export function DatePick({ id, label, value, min, max, hrefBase }: { id: string; label: string; value: string; min: string; max: string; hrefBase: string }) {
  const router = useRouter();
  return (
    <div>
      <label className="glass-label" htmlFor={id}>{label}</label>
      <input
        id={id}
        type="date"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          if (v >= min && v <= max) router.push(`${hrefBase}${hrefBase.includes('?') ? '&' : '?'}data=${v}`, { scroll: false });
        }}
        className="glass-input !w-auto"
      />
    </div>
  );
}
