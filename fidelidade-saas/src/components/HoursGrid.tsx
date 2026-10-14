'use client';

import { useRef, useState } from 'react';
import { DAY_NAMES, DISPLAY_ORDER, type Schedule } from '@/lib/hours';
import { Icon } from './Icons';

/**
 * Horário por dia da semana: uma linha por dia (nome, fechado, "repetir em todos" e abre/fecha).
 * "Repetir em todos" copia o horário do dia para a semana inteira e deixa desfazer.
 * Controlado pelo formulário que o contém.
 */
export function HoursGrid({ days, setDays, idPrefix }: { days: Schedule; setDays: React.Dispatch<React.SetStateAction<Schedule>>; idPrefix: string }) {
  const [copied, setCopied] = useState<{ from: string; before: Schedule } | null>(null);
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = (day: number, patch: Partial<Schedule[number]>) => {
    setCopied(null);
    setDays((all) => all.map((d) => (d.day === day ? { ...d, ...patch } : d)));
  };

  /** Copia o horário (ou "fechado") deste dia para todos os outros, guardando o anterior para desfazer. */
  const applyToAll = (day: number) => {
    const before = days;
    setDays((all) => {
      const src = all.find((d) => d.day === day)!; // sempre o estado mais recente
      return all.map((d) => ({ ...d, closed: src.closed, open: src.open, close: src.close }));
    });
    setCopied({ from: DAY_NAMES[day], before });
    if (hide.current) clearTimeout(hide.current);
    hide.current = setTimeout(() => setCopied(null), 8000);
  };

  const undo = () => {
    if (!copied) return;
    setDays(copied.before);
    setCopied(null);
  };

  const time = 'glass-input min-w-0 flex-1 !px-2 !py-2 text-center sm:!w-[7.5rem] sm:flex-none';

  return (
    <div className="space-y-2">
      <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {DISPLAY_ORDER.map((dayNumber) => {
          const d = days.find((x) => x.day === dayNumber)!;
          const name = DAY_NAMES[dayNumber];
          const short = name.replace('-feira', '');
          return (
            <li key={dayNumber} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:flex sm:gap-4">
              <span className="order-1 min-w-0 whitespace-nowrap text-sm font-semibold text-slate-800 sm:w-[7rem] sm:shrink-0">
                <span className="sm:hidden">{short}</span>
                <span className="hidden sm:inline">{name}</span>
              </span>

              {d.closed ? (
                <p className="order-3 col-span-2 text-sm text-slate-500 sm:order-2 sm:flex-1">Não abre neste dia</p>
              ) : (
                <div className="order-3 col-span-2 flex min-w-0 items-center gap-2 text-sm text-slate-500 sm:order-2 sm:flex-1">
                  <label className="sr-only" htmlFor={`${idPrefix}o-${dayNumber}`}>Abre — {name}</label>
                  <input id={`${idPrefix}o-${dayNumber}`} type="time" required className={time} value={d.open} onChange={(e) => update(dayNumber, { open: e.target.value })} />
                  <span aria-hidden className="shrink-0">às</span>
                  <label className="sr-only" htmlFor={`${idPrefix}c-${dayNumber}`}>Fecha — {name}</label>
                  <input id={`${idPrefix}c-${dayNumber}`} type="time" required className={time} value={d.close} onChange={(e) => update(dayNumber, { close: e.target.value })} />
                </div>
              )}

              <div className="order-2 flex items-center gap-3 sm:order-3 sm:shrink-0">
                <label className="flex min-h-[36px] cursor-pointer items-center gap-2 whitespace-nowrap text-sm text-slate-600">
                  <input type="checkbox" className="h-4 w-4 rounded accent-electric-500" checked={d.closed} onChange={(e) => update(dayNumber, { closed: e.target.checked })} />
                  Fechado
                </label>
                <button
                  type="button"
                  onClick={() => applyToAll(dayNumber)}
                  className="inline-flex min-h-[36px] items-center gap-1.5 whitespace-nowrap rounded-md border border-[#C3D2F4] bg-[#F3F6FD] px-2.5 text-xs font-semibold text-electric-600 hover:bg-[#E8EEFB]"
                  aria-label={`Repetir o horário de ${name} em todos os dias da semana`}
                >
                  <Icon name="copy" size={14} /> Repetir em todos<span className="hidden sm:inline"> os dias</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {copied ? (
        <p role="status" className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <Icon name="check" size={16} className="shrink-0" />
          <span className="min-w-0 flex-1">O horário de {copied.from.toLowerCase()} foi aplicado a todos os dias. Ajuste só o que for diferente.</span>
          <button type="button" onClick={undo} className="font-semibold underline underline-offset-2">Desfazer</button>
        </p>
      ) : (
        <p className="text-xs text-slate-500">
          Atalho: preencha um dia e toque em “Repetir em todos”. Depois ajuste só o que muda (ex.: sábado e domingo). Se fechar depois da meia-noite, use o
          horário normalmente (ex.: abre 18:00, fecha 02:00).
        </p>
      )}
    </div>
  );
}
