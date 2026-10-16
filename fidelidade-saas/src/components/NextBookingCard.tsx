import Link from 'next/link';
import { answerBookingReminder } from '@/app/actions/booking';
import { formatBookingWhen } from '@/lib/booking';
import { Icon } from './Icons';

export type NextBooking = {
  id: string;
  serviceName: string;
  startsAt: Date;
  status: string;
  reminderSentAt: Date | null;
  reminderAnswer: string | null;
  restaurant: { name: string };
  resource?: { name: string } | null;
};

const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

/** Próximo horário do cliente: bloco de data, serviço e lugar; quando o lembrete já foi enviado, mostra "Sim, estarei lá / Liberar". */
export function NextBookingCard({ booking, back = '/carteira' }: { booking: NextBooking; back?: '/carteira' | '/avisos' }) {
  const br = new Date(booking.startsAt.getTime() - 3 * 3600e3);
  const asking = !!booking.reminderSentAt && !booking.reminderAnswer;
  return (
    <div className="glass-panel !rounded-[22px] p-4">
      <Link href="/perfil/agendamentos" className="flex items-center gap-3" aria-label={`Seu próximo horário: ${booking.serviceName}, ${formatBookingWhen(booking.startsAt)}`}>
        <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-[#0F1F3D] text-white">
          <span className="text-[10px] font-bold tracking-wider text-lima">{MONTHS[br.getUTCMonth()]}</span>
          <span className="text-xl font-extrabold leading-none">{br.getUTCDate()}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold uppercase tracking-wider text-slate-500">Seu próximo horário</span>
          <span className="block truncate font-bold text-slate-800">{booking.serviceName} · {formatBookingWhen(booking.startsAt)}</span>
          <span className="block truncate text-xs text-slate-500">{booking.restaurant.name}{booking.resource ? ` · com ${booking.resource.name}` : ''}</span>
        </span>
        <span className={booking.status === 'PENDING' ? 'rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800' : 'chip-verde'}>
          {booking.status === 'PENDING' ? 'Aguardando' : 'Confirmado'}
        </span>
      </Link>
      {asking && (
        <div role="group" aria-label={`Está tudo certo? ${booking.serviceName}`} className="mt-3 space-y-2 rounded-2xl bg-[#EAF0FF] p-3">
          <p className="flex items-center gap-2 text-sm font-bold text-primary"><Icon name="bell" size={16} className="text-electric-600" /> Está tudo certo para o seu horário?</p>
          <div className="flex flex-wrap gap-2">
            <form action={answerBookingReminder} autoComplete="off">
              <input type="hidden" name="id" value={booking.id} /><input type="hidden" name="answer" value="yes" /><input type="hidden" name="back" value={back} />
              <button className="glass-button-navy btn-sm">Sim, estarei lá</button>
            </form>
            <form action={answerBookingReminder} autoComplete="off">
              <input type="hidden" name="id" value={booking.id} /><input type="hidden" name="answer" value="no" /><input type="hidden" name="back" value={back} />
              <button className="glass-button-ghost btn-sm">Liberar horário</button>
            </form>
          </div>
        </div>
      )}
      {booking.reminderAnswer === 'OK' && <p className="mt-2 text-xs font-semibold text-emerald-700">Você confirmou que vai. Até já!</p>}
    </div>
  );
}
