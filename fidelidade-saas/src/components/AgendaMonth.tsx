import Link from 'next/link';
import { addDaysKey, dateKeyOf, weekdayOf } from '@/lib/booking';

export type MonthBooking = { startsAt: Date; status: string };

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const FULL = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const DOT: Record<string, string> = { PENDING: '#F59E0B', CONFIRMED: '#2150C9', COMPLETED: '#16A34A', NO_SHOW: '#E11D48' };

/**
 * Agenda do mês em calendário: cada dia mostra quantos atendimentos tem e a situação deles (pontinhos coloridos).
 * Tocar num dia abre aquele dia na agenda. Dias de fora do mês aparecem apagados.
 */
export function AgendaMonth({ from, to, today, bookings, dayHref }: { from: string; to: string; today: string; bookings: MonthBooking[]; dayHref: (key: string) => string }) {
  const first = addDaysKey(from, -((weekdayOf(from) + 6) % 7)); // segunda da primeira semana
  const total = Math.ceil((Date.parse(addDaysKey(to, 6 - ((weekdayOf(to) + 6) % 7))) - Date.parse(first)) / 86_400_000) + 1;
  const keys = Array.from({ length: total }, (_, i) => addDaysKey(first, i));

  const byDay = new Map<string, Record<string, number>>();
  for (const b of bookings) {
    if (b.status === 'CANCELED') continue;
    const k = dateKeyOf(b.startsAt);
    const c = byDay.get(k) ?? {};
    c[b.status] = (c[b.status] ?? 0) + 1;
    byDay.set(k, c);
  }

  return (
    <section aria-label="Agenda do mês em calendário" className="glass-panel !rounded-[22px] p-3" data-testid="agenda-month">
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500" aria-hidden>
        {WEEKDAYS.map((w) => <span key={w} className="py-1">{w}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {keys.map((k) => {
          const c = byDay.get(k) ?? {};
          const n = Object.values(c).reduce((a, b) => a + b, 0);
          const inMonth = k >= from && k <= to;
          const isToday = k === today;
          const label = `${FULL[weekdayOf(k)]}, ${k.slice(8)}/${k.slice(5, 7)}: ${n === 0 ? 'sem agendamentos' : `${n} ${n === 1 ? 'agendamento' : 'agendamentos'}${c.PENDING ? `, ${c.PENDING} aguardando` : ''}`}`;
          return (
            <Link
              key={k}
              href={dayHref(k)}
              aria-label={label}
              data-testid="month-day"
              data-count={n}
              className={`hover-tint flex min-h-[4.25rem] flex-col justify-between rounded-xl border p-1.5 ${n > 0 ? 'border-[#cfd9f3] bg-[#F3F6FD]' : 'border-slate-100 bg-white'} ${inMonth ? '' : 'opacity-40'} ${isToday ? 'ring-2 ring-primary' : ''}`}
            >
              <span className={`text-sm font-bold ${isToday ? 'text-primary' : 'text-slate-700'}`}>{Number(k.slice(8))}</span>
              {n > 0 && (
                <span className="flex flex-col gap-1">
                  <span className="text-[11px] font-bold text-primary">{n}<span className="hidden sm:inline"> {n === 1 ? 'agend.' : 'agends.'}</span></span>
                  <span className="flex flex-wrap gap-0.5" aria-hidden>
                    {Object.entries(DOT).filter(([s]) => c[s]).map(([s]) => <i key={s} className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: DOT[s] }} />)}
                  </span>
                </span>
              )}
            </Link>
          );
        })}
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px] text-slate-500" aria-hidden>
        {[['PENDING', 'aguardando'], ['CONFIRMED', 'confirmado'], ['COMPLETED', 'concluído'], ['NO_SHOW', 'faltou']].map(([s, l]) => (
          <span key={s} className="inline-flex items-center gap-1"><i className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: DOT[s] }} />{l}</span>
        ))}
      </p>
    </section>
  );
}
