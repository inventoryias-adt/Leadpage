'use client';

import { DAY_NAMES, DISPLAY_ORDER, type Schedule } from '@/lib/hours';

/** Grade de horário por dia da semana (controlada pelo formulário que a contém), com "Aplicar a todos os dias". */
export function HoursGrid({ days, setDays, idPrefix }: { days: Schedule; setDays: React.Dispatch<React.SetStateAction<Schedule>>; idPrefix: string }) {
  const update = (day: number, patch: Partial<Schedule[number]>) =>
    setDays((all) => all.map((d) => (d.day === day ? { ...d, ...patch } : d)));

  /** Copia o horário (ou "fechado") deste dia para todos os outros. */
  const applyToAll = (day: number) =>
    setDays((all) => {
      const src = all.find((d) => d.day === day)!; // sempre o estado mais recente, nunca um valor "velho" do render
      return all.map((d) => ({ ...d, closed: src.closed, open: src.open, close: src.close }));
    });

  return (
    <div className="space-y-3">
      <ul className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
        {DISPLAY_ORDER.map((dayNumber) => {
          const d = days.find((x) => x.day === dayNumber)!;
          const name = DAY_NAMES[dayNumber];
          return (
            <li key={dayNumber} className="glass-inset p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="font-semibold text-slate-800">{name}</span>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    className="h-5 w-5 rounded accent-electric-500"
                    checked={d.closed}
                    onChange={(e) => update(dayNumber, { closed: e.target.checked })}
                  />
                  Fechado
                </label>
              </div>

              {d.closed ? (
                <p className="text-sm text-slate-500">Não abre neste dia.</p>
              ) : (
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[7rem] flex-1">
                    <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor={`${idPrefix}o-${dayNumber}`}>Abre</label>
                    <input id={`${idPrefix}o-${dayNumber}`} type="time" required className="glass-input !py-2" value={d.open} onChange={(e) => update(dayNumber, { open: e.target.value })} />
                  </div>
                  <div className="min-w-[7rem] flex-1">
                    <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor={`${idPrefix}c-${dayNumber}`}>Fecha</label>
                    <input id={`${idPrefix}c-${dayNumber}`} type="time" required className="glass-input !py-2" value={d.close} onChange={(e) => update(dayNumber, { close: e.target.value })} />
                  </div>
                </div>
              )}

              <button type="button" onClick={() => applyToAll(dayNumber)} className="glass-button-ghost btn-sm mt-3" aria-label={`Aplicar o horário de ${name} a todos os dias`}>
                Aplicar a todos os dias
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-slate-500">
        Dica: preencha um dia, toque em “Aplicar a todos os dias” e depois ajuste só o que muda (ex.: sábado e domingo).
        Se fechar depois da meia-noite, use o horário normalmente (ex.: abre 18:00, fecha 02:00).
      </p>
    </div>
  );
}
