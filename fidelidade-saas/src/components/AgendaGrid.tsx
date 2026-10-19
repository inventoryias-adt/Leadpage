import { gridRange, offRanges, type DayWindow } from '@/lib/agenda-hours';
import { resourceColor } from '@/lib/palette';
import { hmOf } from '@/lib/booking';
import { PlaceAvatar } from './Visual';

export type GridStaff = { id: string; name: string; color: string | null; photoUrl: string | null; work?: DayWindow };
export type GridBooking = {
  id: string;
  resourceId: string | null;
  startsAt: Date;
  endsAt: Date;
  serviceName: string;
  customerName: string;
  status: string;
};

const PX_PER_HOUR = 84;
const mins = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));

/** Cores por situação, como no PDF: azul confirmado, verde concluído, âmbar aguardando, rosa faltou. */
export const STATUS_CHIP: Record<string, { label: string; bg: string; fg: string }> = {
  PENDING: { label: 'Aguardando', bg: '#FFF1D6', fg: '#B45309' },
  CONFIRMED: { label: 'Confirmado', bg: '#DBE7FF', fg: '#1A3FA3' },
  COMPLETED: { label: 'Concluído', bg: '#E6F7EC', fg: '#15803d' },
  NO_SHOW: { label: 'Faltou', bg: '#FDE2E4', fg: '#BE123C' },
};

/**
 * Agenda do dia em grade (estilo Google Agenda): uma coluna por profissional, horas na lateral e um bloco por atendimento.
 * O bloco usa a cor da situação (aguardando, confirmado, concluído, faltou); a cor do profissional fica no cabeçalho da coluna. Ao tocar, abre os detalhes e as ações.
 */
export function AgendaGrid({ staff, bookings, nowMin, open, openLabel, linkBase }: { staff: GridStaff[]; bookings: GridBooking[]; nowMin?: number | null; open?: DayWindow; openLabel?: string; linkBase?: string }) {
  const shown = bookings.filter((b) => b.status !== 'CANCELED');
  if (shown.length === 0) return null;
  const hasNoOne = shown.some((b) => !b.resourceId || !staff.some((s) => s.id === b.resourceId));
  const cols: GridStaff[] = [...staff, ...(hasNoOne ? [{ id: '', name: 'Sem profissional', color: 'azul', photoUrl: null }] : [])];
  const colOf = (b: GridBooking) => (b.resourceId && staff.some((s) => s.id === b.resourceId) ? b.resourceId : '');

  // As horas seguem o horário de funcionamento do estabelecimento; só crescem se algum agendamento cair fora dele.
  const { startH, endH } = gridRange(open ?? null, shown.map((b) => ({ startMin: mins(hmOf(b.startsAt)), endMin: mins(hmOf(b.endsAt)) || 24 * 60 })));
  const hours = Array.from({ length: endH - startH + 1 }, (_, i) => startH + i);
  const height = (endH - startH) * PX_PER_HOUR;
  const y = (m: number) => ((m - startH * 60) / 60) * PX_PER_HOUR;

  return (
    <section aria-label="Agenda do dia em grade" className="glass-panel !rounded-[22px] p-3" data-testid="agenda-grid">
      <p className="mb-2 flex flex-wrap items-center gap-2 px-1 text-xs text-slate-500" data-testid="agenda-hours">
        <span className="font-semibold text-slate-700">{open === 'closed' ? 'Estabelecimento fechado neste dia' : open ? `Atendimento: ${openLabel ?? ''}` : 'Horário de funcionamento não cadastrado'}</span>
        <span className="inline-flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm bg-slate-200" /> fora do horário de atendimento</span>
      </p>
      <div className="overflow-x-auto">
        <div className="flex min-w-fit">
          <div className="w-11 shrink-0" aria-hidden>
            <div className="h-12" />
            <div className="relative" style={{ height }}>
              {hours.map((h) => (
                <span key={h} className="absolute right-2 -translate-y-1/2 text-[11px] font-medium text-slate-400" style={{ top: (h - startH) * PX_PER_HOUR }}>{String(h).padStart(2, '0')}:00</span>
              ))}
            </div>
          </div>
          {cols.map((c) => {
            const tone = resourceColor({ id: c.id || 'sem', color: c.color });
            return (
              <div key={c.id || 'none'} className="min-w-[9.5rem] flex-1 border-l border-slate-100">
                <div className="flex h-12 items-center gap-2 px-2">
                  <span className="rounded-full ring-2" style={{ '--tw-ring-color': tone.hex } as React.CSSProperties}><PlaceAvatar name={c.name} src={c.photoUrl} size={30} /></span>
                  <span className="min-w-0 truncate text-[15px] font-bold text-primary">{c.name}</span>
                </div>
                <div className="relative" style={{ height }}>
                  {offRanges(c.work !== undefined && c.work !== null ? c.work : open ?? null, startH * 60, endH * 60).map((r) => (
                    <div key={r.from} className="absolute inset-x-0 bg-slate-200/60" style={{ top: y(r.from), height: y(r.to) - y(r.from), backgroundImage: 'repeating-linear-gradient(135deg,rgba(148,163,184,.18) 0 6px,transparent 6px 12px)' }} aria-hidden />
                  ))}
                  {hours.map((h) => <div key={h} className="absolute inset-x-0 border-t border-slate-100" style={{ top: (h - startH) * PX_PER_HOUR }} />)}
                  {shown.filter((b) => colOf(b) === c.id).map((b) => {
                    const s = mins(hmOf(b.startsAt));
                    const e = mins(hmOf(b.endsAt)) || 24 * 60;
                    const chip = STATUS_CHIP[b.status] ?? STATUS_CHIP.CONFIRMED;
                    const tall = y(e) - y(s) >= 44;
                    return (
                      <a
                        key={b.id}
                        href={`${linkBase ?? ''}${(linkBase ?? '').includes('?') ? '&' : '?'}ag=${b.id}`}
                        data-testid="agenda-block"
                        className="absolute inset-x-1.5 overflow-hidden rounded-[14px] px-3 py-1.5 text-[13px] font-bold leading-tight transition-shadow hover:shadow-md"
                        style={{ top: y(s) + 2, height: Math.max(28, y(e) - y(s) - 4), background: chip.bg, color: chip.fg }}
                        aria-label={`${hmOf(b.startsAt)} ${b.serviceName}, ${b.customerName}, ${chip.label}`}
                      >
                        <span className="block truncate">{b.serviceName} · {b.customerName}</span>
                        {tall && <span className="mt-0.5 block text-[11.5px] font-semibold opacity-85">{hmOf(b.startsAt)} · {chip.label}</span>}
                      </a>
                    );
                  })}
                  {nowMin != null && nowMin >= startH * 60 && nowMin <= endH * 60 && (
                    <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-rose-500" style={{ top: y(nowMin) }}><span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-rose-500" /></div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
