import Link from 'next/link';
import { gridRange, offRanges, unionWindow, type DayWindow } from '@/lib/agenda-hours';
import { dateKeyOf, hmOf } from '@/lib/booking';
import { resourceColor } from '@/lib/palette';
import { STATUS_CHIP, type GridBooking } from './AgendaGrid';
import { ScrollToToday } from './ScrollToToday';

export type WeekDay = { key: string; weekday: string; num: string; today: boolean; open: DayWindow };
export type WeekBooking = GridBooking & { resourceColor: string | null };

const PX_PER_HOUR = 56;
const mins = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));

/** Agendamentos que se sobrepõem no mesmo dia ficam lado a lado: cada um recebe uma faixa (`lane`) de um total (`of`). */
function layout(items: { s: number; e: number }[]): { lane: number; of: number }[] {
  const order = items.map((_, i) => i).sort((x, y) => items[x].s - items[y].s || items[x].e - items[y].e);
  const out = items.map(() => ({ lane: 0, of: 1 }));
  let cluster: number[] = [];
  let ends: number[] = []; // fim do último atendimento de cada faixa
  let clusterEnd = -Infinity;
  const close = () => { for (const i of cluster) out[i].of = Math.max(1, ends.length); cluster = []; ends = []; };
  for (const i of order) {
    if (items[i].s >= clusterEnd) { close(); clusterEnd = -Infinity; } // não encosta no grupo anterior: começa outro
    let lane = ends.findIndex((end) => end <= items[i].s);
    if (lane === -1) { lane = ends.length; ends.push(items[i].e); } else ends[lane] = items[i].e;
    out[i].lane = lane;
    cluster.push(i);
    clusterEnd = Math.max(clusterEnd, items[i].e);
  }
  close();
  return out;
}

/**
 * Agenda da semana em grade (estilo Google Agenda): uma coluna por dia (segunda a domingo), horas na lateral e um bloco por atendimento.
 * O bloco usa a cor da situação; a faixa à esquerda leva a cor do profissional. Tocar no dia abre o dia; tocar no bloco abre os detalhes.
 */
export function AgendaWeek({ days, bookings, nowMin, linkBase, dayHref }: { days: WeekDay[]; bookings: WeekBooking[]; nowMin?: number | null; linkBase: string; dayHref: (key: string) => string }) {
  const shown = bookings.filter((b) => b.status !== 'CANCELED');
  const open = unionWindow(days.map((d) => d.open));
  const { startH, endH } = gridRange(open, shown.map((b) => ({ startMin: mins(hmOf(b.startsAt)), endMin: mins(hmOf(b.endsAt)) || 24 * 60 })));
  const hours = Array.from({ length: endH - startH + 1 }, (_, i) => startH + i);
  const height = (endH - startH) * PX_PER_HOUR;
  const y = (m: number) => ((m - startH * 60) / 60) * PX_PER_HOUR;

  return (
    <section aria-label="Agenda da semana em grade" className="glass-panel !rounded-[22px] p-3" data-testid="agenda-week">
      <ScrollToToday className="overflow-x-auto">
        <div className="flex min-w-fit">
          <div className="w-10 shrink-0" aria-hidden>
            <div className="h-12" />
            <div className="relative" style={{ height }}>
              {hours.map((h) => (
                <span key={h} className="absolute right-1.5 -translate-y-1/2 text-[11px] font-medium text-slate-400" style={{ top: (h - startH) * PX_PER_HOUR }}>{String(h).padStart(2, '0')}h</span>
              ))}
            </div>
          </div>
          {days.map((d) => {
            const mine = shown.filter((b) => dateKeyOf(b.startsAt) === d.key);
            const pos = layout(mine.map((b) => ({ s: mins(hmOf(b.startsAt)), e: mins(hmOf(b.endsAt)) || 24 * 60 })));
            const widest = Math.max(1, ...pos.map((p) => p.of)); // dia com atendimentos ao mesmo tempo ganha uma coluna mais larga para o texto caber
            return (
              <div key={d.key} className="flex-1 border-l border-slate-100" style={{ minWidth: `${Math.max(5.75, widest * 4.75)}rem` }} data-testid="week-day" data-today={d.today}>
                <Link href={dayHref(d.key)} aria-label={`Abrir o dia ${d.weekday} ${d.num}`} className="flex h-12 flex-col items-center justify-center leading-tight">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{d.weekday}</span>
                  <span className={`mt-0.5 flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-sm font-bold ${d.today ? 'bg-primary text-white' : 'text-primary'}`}>{d.num}</span>
                </Link>
                <div className="relative" style={{ height }}>
                  {offRanges(d.open, startH * 60, endH * 60).map((r) => (
                    <div key={r.from} className="absolute inset-x-0" style={{ top: y(r.from), height: y(r.to) - y(r.from), backgroundImage: 'repeating-linear-gradient(135deg,rgba(148,163,184,.18) 0 6px,transparent 6px 12px)', backgroundColor: 'rgba(226,232,240,.6)' }} aria-hidden />
                  ))}
                  {hours.map((h) => <div key={h} className="absolute inset-x-0 border-t border-slate-100" style={{ top: (h - startH) * PX_PER_HOUR }} />)}
                  {mine.map((b, i) => {
                    const s = mins(hmOf(b.startsAt));
                    const e = mins(hmOf(b.endsAt)) || 24 * 60;
                    const chip = STATUS_CHIP[b.status] ?? STATUS_CHIP.CONFIRMED;
                    const { lane, of } = pos[i];
                    const tall = y(e) - y(s) >= 40;
                    return (
                      <a
                        key={b.id}
                        href={`${linkBase}${linkBase.includes('?') ? '&' : '?'}ag=${b.id}`}
                        data-testid="week-block"
                        className="absolute overflow-hidden rounded-lg border-l-4 px-1.5 py-1 text-[11.5px] font-bold leading-tight transition-shadow hover:shadow-md"
                        style={{ top: y(s) + 1, height: Math.max(24, y(e) - y(s) - 2), left: `calc(${(lane * 100) / of}% + 2px)`, width: `calc(${100 / of}% - 4px)`, background: chip.bg, color: chip.fg, borderLeftColor: resourceColor({ id: b.resourceId ?? '', color: b.resourceColor }).hex }}
                        aria-label={`${d.weekday} ${d.num}, ${hmOf(b.startsAt)} ${b.serviceName}, ${b.customerName}, ${chip.label}`}
                      >
                        <span className="block truncate">{hmOf(b.startsAt)} {b.customerName.split(' ')[0]}</span>
                        {tall && <span className="block truncate text-[11px] font-semibold opacity-85">{b.serviceName}</span>}
                      </a>
                    );
                  })}
                  {d.today && nowMin != null && nowMin >= startH * 60 && nowMin <= endH * 60 && (
                    <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-rose-500" style={{ top: y(nowMin) }}><span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-rose-500" /></div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollToToday>
    </section>
  );
}
