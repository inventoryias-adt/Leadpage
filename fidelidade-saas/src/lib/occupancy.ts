import { addDaysKey, dayOccupancy, occupancyPct, type BusyRange } from './booking';
import type { Schedule } from './hours';

export type OccupancyUnit = { id: string; schedule: Schedule | null };
export type OccupancyResource = { id: string; unitId: string | null; capacity: number; schedule?: Schedule | null };
export type OccupancyBooking = BusyRange;
export type OccupancyTimeOff = BusyRange & { unitId: string | null };

export type DayLoad = { date: string; capacityMin: number; bookedMin: number; pct: number | null; bookings: number };
export type OccupancyReport = {
  days: DayLoad[];
  byResource: Record<string, { capacityMin: number; bookedMin: number }>;
  totals: { capacityMin: number; bookedMin: number; pct: number | null; freeMin: number; bookings: number };
};

/**
 * Ocupação da agenda dia a dia: quanto do tempo dos profissionais já está marcado.
 * Cada profissional conta uma vez só, mesmo que atenda em várias unidades (ele não está em dois lugares ao mesmo tempo):
 * vale a unidade em que o expediente dele rende mais naquele dia. Folgas valem para a unidade indicada (ou todas).
 */
export function occupancyReport(input: { from: string; days: number; units: OccupancyUnit[]; resources: OccupancyResource[]; bookings: OccupancyBooking[]; timeOffs: OccupancyTimeOff[] }): OccupancyReport {
  const byResource: OccupancyReport['byResource'] = {};
  const days: DayLoad[] = [];
  for (let i = 0; i < input.days; i++) {
    const date = addDaysKey(input.from, i);
    const best: Record<string, { capacityMin: number; bookedMin: number }> = {};
    for (const unit of input.units) {
      const o = dayOccupancy({
        date,
        schedule: unit.schedule,
        resources: input.resources.filter((r) => !r.unitId || r.unitId === unit.id),
        bookings: input.bookings,
        timeOffs: input.timeOffs.filter((t) => !t.unitId || t.unitId === unit.id),
      });
      for (const [id, v] of Object.entries(o.byResource)) if (!best[id] || v.capacityMin > best[id].capacityMin) best[id] = v;
    }
    let capacityMin = 0;
    let bookedMin = 0;
    for (const [id, v] of Object.entries(best)) {
      capacityMin += v.capacityMin;
      bookedMin += v.bookedMin;
      const acc = (byResource[id] ??= { capacityMin: 0, bookedMin: 0 });
      acc.capacityMin += v.capacityMin;
      acc.bookedMin += v.bookedMin;
    }
    const dayStart = Date.parse(`${date}T00:00:00-03:00`);
    const count = input.bookings.filter((b) => b.startsAt.getTime() >= dayStart && b.startsAt.getTime() < dayStart + 24 * 60 * 60 * 1000).length;
    days.push({ date, capacityMin, bookedMin, pct: occupancyPct({ capacityMin, bookedMin }), bookings: count });
  }
  const capacityMin = days.reduce((s, d) => s + d.capacityMin, 0);
  const bookedMin = days.reduce((s, d) => s + d.bookedMin, 0);
  return { days, byResource, totals: { capacityMin, bookedMin, pct: occupancyPct({ capacityMin, bookedMin }), freeMin: Math.max(0, capacityMin - bookedMin), bookings: days.reduce((s, d) => s + d.bookings, 0) } };
}

/** "3h" ou "1h30" a partir de minutos. */
export function formatHours(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m === 0 ? `${h}h` : h === 0 ? `${m}min` : `${h}h${String(m).padStart(2, '0')}`;
}
