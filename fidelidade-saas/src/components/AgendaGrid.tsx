import { resourceColor } from '@/lib/palette';
import { hmOf } from '@/lib/booking';
import { PlaceAvatar } from './Visual';

export type GridStaff = { id: string; name: string; color: string | null; photoUrl: string | null };
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

const STATUS_CHIP: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Aguardando', cls: 'bg-amber-100 text-amber-800' },
  CONFIRMED: { label: 'Confirmado', cls: 'bg-[#EAF0FF] text-electric-600' },
  COMPLETED: { label: 'Concluído', cls: 'bg-emerald-100 text-emerald-700' },
  NO_SHOW: { label: 'Faltou', cls: 'bg-rose-100 text-rose-700' },
};

/**
 * Agenda do dia em grade (estilo Google Agenda): uma coluna por profissional, horas na lateral e um bloco por atendimento.
 * O bloco usa a cor do profissional; o selo mostra a situação (aguardando, confirmado, concluído, faltou).
 */
export function AgendaGrid({ staff, bookings, nowMin }: { staff: GridStaff[]; bookings: GridBooking[]; nowMin?: number | null }) {
  const shown = bookings.filter((b) => b.status !== 'CANCELED');
  if (shown.length === 0) return null;
  const hasNoOne = shown.some((b) => !b.resourceId || !staff.some((s) => s.id === b.resourceId));
  const cols: GridStaff[] = [...staff, ...(hasNoOne ? [{ id: '', name: 'Sem profissional', color: 'azul', photoUrl: null }] : [])];
  const colOf = (b: GridBooking) => (b.resourceId && staff.some((s) => s.id === b.resourceId) ? b.resourceId : '');

  const firstMin = Math.min(...shown.map((b) => mins(hmOf(b.startsAt))));
  const lastMin = Math.max(...shown.map((b) => mins(hmOf(b.endsAt)) || 24 * 60));
  const startH = Math.max(0, Math.min(8, Math.floor(firstMin / 60)));
  const endH = Math.min(24, Math.max(18, Math.ceil(lastMin / 60)));
  const hours = Array.from({ length: endH - startH + 1 }, (_, i) => startH + i);
  const height = (endH - startH) * PX_PER_HOUR;
  const y = (m: number) => ((m - startH * 60) / 60) * PX_PER_HOUR;

  return (
    <section aria-label="Agenda do dia em grade" className="glass-panel !rounded-[22px] p-3" data-testid="agenda-grid">
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
                  <span className="min-w-0 truncate text-sm font-bold" style={{ color: tone.hex }}>{c.name}</span>
                </div>
                <div className="relative" style={{ height }}>
                  {hours.map((h) => <div key={h} className="absolute inset-x-0 border-t border-slate-100" style={{ top: (h - startH) * PX_PER_HOUR }} />)}
                  {shown.filter((b) => colOf(b) === c.id).map((b) => {
                    const s = mins(hmOf(b.startsAt));
                    const e = mins(hmOf(b.endsAt)) || 24 * 60;
                    const chip = STATUS_CHIP[b.status] ?? STATUS_CHIP.CONFIRMED;
                    const done = b.status === 'COMPLETED' || b.status === 'NO_SHOW';
                    return (
                      <a
                        key={b.id}
                        href={`#ag-${b.id}`}
                        className={`absolute inset-x-1 overflow-hidden rounded-xl border-l-4 px-2 py-1 text-xs leading-tight ${done ? 'opacity-70' : ''} ${b.status === 'PENDING' ? 'border-dashed outline outline-1 outline-amber-300' : ''}`}
                        style={{ top: y(s) + 1, height: Math.max(26, y(e) - y(s) - 2), background: tone.soft, borderColor: tone.hex, color: '#0F1F3D' }}
                        aria-label={`${hmOf(b.startsAt)} ${b.serviceName}, ${b.customerName}, ${chip.label}`}
                      >
                        <span className="flex items-center justify-between gap-1">
                          <b className="truncate">{hmOf(b.startsAt)} · {b.serviceName}</b>
                        </span>
                        <span className="block truncate text-slate-600">{b.customerName}</span>
                        {y(e) - y(s) >= 56 && <span className={`mt-0.5 inline-block rounded-full px-1.5 py-px text-[10px] font-bold ${chip.cls}`}>{chip.label}</span>}
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
