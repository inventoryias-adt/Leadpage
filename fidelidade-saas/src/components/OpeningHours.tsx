import { isOpenNow, summarizeSchedule, type Schedule } from '@/lib/hours';

/** Horário de funcionamento para o cliente final (com selo "aberto agora"). */
export function OpeningHours({ schedule, title = 'Horário para retirar seu prêmio' }: { schedule: Schedule; title?: string }) {
  const open = isOpenNow(schedule);
  return (
    <div className="glass-inset p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-primary">{title}</p>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            open ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
          }`}
        >
          {open ? 'Aberto agora' : 'Fechado agora'}
        </span>
      </div>
      <ul className="space-y-1 text-sm">
        {summarizeSchedule(schedule).map((g) => (
          <li key={g.label} className="flex justify-between gap-3">
            <span className="text-slate-600">{g.label}</span>
            <span className={`font-medium ${g.hours === 'Fechado' ? 'text-slate-400' : 'text-slate-800'}`}>{g.hours}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
