'use client';

import { DAY_NAMES, DISPLAY_ORDER, type Schedule } from '@/lib/hours';

/**
 * Horário por dia da semana, compacto: uma linha por dia (nome, abre, fecha, fechado e copiar para os outros dias).
 * Controlado pelo formulário que o contém.
 */
export function HoursGrid({ days, setDays, idPrefix }: { days: Schedule; setDays: React.Dispatch<React.SetStateAction<Schedule>>; idPrefix: string }) {
  const update = (day: number, patch: Partial<Schedule[number]>) =>
    setDays((all) => all.map((d) => (d.day === day ? { ...d, ...patch } : d)));

  /** Copia o horário (ou "fechado") deste dia para todos os outros. */
  const applyToAll = (day: number) =>
    setDays((all) => {
      const src = all.find((d) => d.day === day)!; // sempre o estado mais recente, nunca um valor "velho" do render
      return all.map((d) => ({ ...d, closed: src.closed, open: src.open, close: src.close }));
    });

  const time = 'glass-input min-w-0 !w-full !px-2 !py-1.5 !text-sm sm:!w-[7.5rem]';

  return (
    <div className="space-y-2">
      <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {DISPLAY_ORDER.map((dayNumber) => {
          const d = days.find((x) => x.day === dayNumber)!;
          const name = DAY_NAMES[dayNumber];
          return (
            <li key={dayNumber} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-2 gap-y-1.5 px-3 py-2 sm:gap-x-3 sm:grid-cols-[6.6rem_17rem_auto_auto]">
              <span className="order-1 whitespace-nowrap text-sm font-medium text-slate-800">{name}</span>

              {d.closed ? (
                <span className="order-4 col-span-3 text-sm text-slate-500 sm:order-2 sm:col-span-1">Não abre neste dia</span>
              ) : (
                <span className="order-4 col-span-3 flex min-w-0 items-center gap-1.5 text-sm text-slate-500 sm:order-2 sm:col-span-1">
                  <label className="sr-only" htmlFor={`${idPrefix}o-${dayNumber}`}>Abre — {name}</label>
                  <input id={`${idPrefix}o-${dayNumber}`} type="time" required className={time} value={d.open} onChange={(e) => update(dayNumber, { open: e.target.value })} />
                  <span aria-hidden>às</span>
                  <label className="sr-only" htmlFor={`${idPrefix}c-${dayNumber}`}>Fecha — {name}</label>
                  <input id={`${idPrefix}c-${dayNumber}`} type="time" required className={time} value={d.close} onChange={(e) => update(dayNumber, { close: e.target.value })} />
                </span>
              )}

              <label className="order-2 flex items-center gap-1.5 whitespace-nowrap text-sm text-slate-600 sm:order-3">
                <input type="checkbox" className="h-4 w-4 rounded accent-electric-500" checked={d.closed} onChange={(e) => update(dayNumber, { closed: e.target.checked })} />
                Fechado
              </label>
              <button
                type="button"
                onClick={() => applyToAll(dayNumber)}
                className="order-3 whitespace-nowrap rounded-md px-1.5 py-1 text-xs sm:order-4 font-semibold text-electric-600 hover:bg-[#E9EDF3]"
                aria-label={`Aplicar o horário de ${name} a todos os dias`}
                title="Copiar este horário para todos os dias"
              >
                Copiar<span className="hidden sm:inline"> p/ todos</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-slate-500">
        Dica: preencha um dia, toque em “Copiar p/ todos” e depois ajuste só o que muda (ex.: sábado e domingo). Se fechar depois da meia-noite, use o horário
        normalmente (ex.: abre 18:00, fecha 02:00).
      </p>
    </div>
  );
}
