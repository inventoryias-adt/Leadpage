'use client';

import { useRef } from 'react';
import { setCurrentUnitAction } from '@/app/actions/restaurant';
import { Icon } from './Icons';

/** Escolhe em qual unidade este aparelho está operando (o caixa lança pontos e entrega prêmios por ela). */
export function UnitSwitcher({ units, currentId }: { units: { id: string; name: string }[]; currentId: string }) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={setCurrentUnitAction} className="flex items-center gap-1.5">
      <label htmlFor="unit-switch" className="sr-only">Unidade deste caixa</label>
      <Icon name="pin" size={16} className="text-electric-600" />
      <select
        id="unit-switch"
        name="unitId"
        defaultValue={currentId}
        onChange={() => form.current?.requestSubmit()}
        className="max-w-[9.5rem] cursor-pointer truncate rounded-lg border border-slate-300 bg-white/90 py-1.5 pl-2 pr-1 text-sm font-semibold text-slate-700 transition-colors hover:border-electric-600 focus:border-electric-600 focus:outline-none focus:ring-2 focus:ring-electric-500/30"
      >
        {units.map((u) => (
          <option key={u.id} value={u.id}>{u.name}</option>
        ))}
      </select>
    </form>
  );
}
