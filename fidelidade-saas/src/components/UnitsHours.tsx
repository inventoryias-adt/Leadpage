import { parseSchedule } from '@/lib/hours';
import { Icon } from './Icons';
import { OpeningHours } from './OpeningHours';

export type UnitHoursInfo = { id: string; name: string; address: string | null; openingSchedule: unknown };

/** Horário + endereço de uma ou mais unidades (o nome só aparece quando há mais de uma). */
export function UnitsHours({ units, title, showNames }: { units: UnitHoursInfo[]; title?: string; showNames?: boolean }) {
  const multi = showNames ?? units.length > 1;
  const blocks = units.filter((u) => parseSchedule(u.openingSchedule) || u.address);
  if (blocks.length === 0) return null;
  return (
    <div className="space-y-3">
      {blocks.map((u) => {
        const schedule = parseSchedule(u.openingSchedule);
        const heading = multi ? (title ? `${title} · ${u.name}` : u.name) : title;
        return (
          <div key={u.id} className="space-y-2">
            {schedule && <OpeningHours schedule={schedule} title={heading} />}
            {u.address && (
              <p className="flex items-center justify-center gap-1 text-center text-xs text-slate-500">
                <Icon name="pin" size={13} /> {multi && !schedule ? `${u.name}: ` : ''}{u.address}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
