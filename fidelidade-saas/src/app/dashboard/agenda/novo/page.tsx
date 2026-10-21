import Link from 'next/link';
import { Icon } from '@/components/Icons';
import { OwnerBookingForm } from '@/components/OwnerBookingForm';
import { addDaysKey, formatBookingWhen, parseDateKey, todayKey } from '@/lib/booking';
import { ensureDefaultService, slotsForDay, staffFor } from '@/lib/booking-db';
import { prisma } from '@/lib/db';
import { requireActiveRestaurant } from '@/lib/session';

export const metadata = { title: 'Novo agendamento' };
export const dynamic = 'force-dynamic';

type SP = { servico?: string; unidade?: string; prof?: string; data?: string; hora?: string };

/** Encaixe: o dono marca um horário pelo telefone, WhatsApp ou balcão, com as mesmas travas que valem para o cliente. */
export default async function NovoAgendamentoPage({ searchParams }: { searchParams: Promise<SP> }) {
  const restaurant = await requireActiveRestaurant();
  const sp = await searchParams;
  const rid = restaurant.id;
  let services = await prisma.service.findMany({ where: { restaurantId: rid, active: true }, orderBy: { createdAt: 'asc' } });
  if (services.length === 0 && (await ensureDefaultService(restaurant))) services = await prisma.service.findMany({ where: { restaurantId: rid, active: true }, orderBy: { createdAt: 'asc' } });
  const units = await prisma.unit.findMany({ where: { restaurantId: rid, active: true }, orderBy: { createdAt: 'asc' } });
  const back = <Link href="/dashboard/agenda" className="inline-flex items-center gap-1 text-sm font-semibold text-electric-600"><Icon name="back" size={16} /> Agenda</Link>;
  if (services.length === 0 || units.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        {back}
        <h1 className="text-2xl font-extrabold tracking-tight text-primary">Novo agendamento</h1>
        <p className="glass-panel-sm p-4 text-sm text-slate-600">Cadastre ao menos um serviço em <Link href="/dashboard/configuracoes?etapa=agenda&abrir=agenda-conteudo#agenda" className="link-inline">Serviços e regras</Link> para marcar horários.</p>
      </div>
    );
  }
  const service = services.find((s) => s.id === sp.servico) ?? services[0];
  const unit = units.find((u) => u.id === sp.unidade) ?? units[0];
  const staff = await staffFor(prisma, { restaurantId: rid, service, unitId: unit.id });
  const prof = staff.find((p) => p.id === sp.prof) ?? null;
  const today = todayKey();
  const date = sp.data && parseDateKey(sp.data) && sp.data >= today ? sp.data : today;
  const { slots } = await slotsForDay(prisma, {
    restaurantId: rid,
    policy: { bookingMinNoticeMin: 0, bookingMaxDaysAhead: 365, bookingBufferMin: restaurant.bookingBufferMin },
    service,
    unit,
    date,
    resourceId: prof?.id,
  });
  const chosen = sp.hora ? slots.find((s) => s.time === sp.hora) ?? null : null;
  const link = (over: Partial<SP>) => {
    const q = new URLSearchParams();
    const merged: SP = { servico: service.id, unidade: unit.id, prof: prof?.id, data: date, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    return `/dashboard/agenda/novo?${q}`;
  };
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        {back}
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-primary">Novo agendamento</h1>
        <p className="text-sm text-slate-600">Para quem ligou, chamou no WhatsApp ou está no balcão. Os horários seguem o expediente, as folgas e o que já está marcado.</p>
      </header>

      <form method="get" className="glass-panel space-y-4 p-4 sm:p-5" aria-label="O que marcar">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="glass-label" htmlFor="nv-servico">Serviço</label>
            <select id="nv-servico" name="servico" className="glass-input" defaultValue={service.id}>{services.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.durationMin} min</option>)}</select>
          </div>
          {units.length > 1 && (
            <div>
              <label className="glass-label" htmlFor="nv-unidade">Unidade</label>
              <select id="nv-unidade" name="unidade" className="glass-input" defaultValue={unit.id}>{units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
            </div>
          )}
          <div>
            <label className="glass-label" htmlFor="nv-prof">Com quem</label>
            <select id="nv-prof" name="prof" className="glass-input" defaultValue={prof?.id ?? ''}>
              <option value="">Qualquer um</option>
              {staff.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="glass-label" htmlFor="nv-data">Dia</label>
            <input id="nv-data" name="data" type="date" min={today} max={addDaysKey(today, 365)} className="glass-input" defaultValue={date} />
          </div>
        </div>
        <button className="glass-button-navy" data-testid="ver-horarios">Ver horários</button>
      </form>

      <section aria-labelledby="horarios">
        <h2 id="horarios" className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Horários livres de {formatBookingWhen(new Date(`${date}T12:00:00-03:00`)).split(' às ')[0]}</h2>
        {slots.length === 0 ? (
          <p className="glass-panel-sm p-4 text-sm text-slate-600">Sem horários livres neste dia (fechado, em folga ou tudo ocupado). Tente outro dia ou outro profissional.</p>
        ) : (
          <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6" data-testid="owner-slots">
            {slots.map((s) => (
              <li key={s.time}>
                <Link href={link({ hora: s.time })} aria-current={chosen?.time === s.time ? 'true' : undefined} className={`block rounded-xl border py-2.5 text-center text-sm font-semibold ${chosen?.time === s.time ? 'border-[#0F1F3D] bg-[#0F1F3D] text-[#C6F432]' : 'border-slate-200 bg-white text-slate-800 hover:border-[#0F1F3D]'}`}>{s.time}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {chosen && (
        <section aria-labelledby="quem" className="glass-panel space-y-4 p-4 sm:p-5">
          <div>
            <h2 id="quem" className="text-lg font-bold text-primary">Para quem?</h2>
            <p className="text-sm text-slate-700"><strong>{service.name}</strong> em <strong>{formatBookingWhen(chosen.startsAt)}</strong>{prof ? <> com <strong>{prof.name}</strong></> : null}</p>
          </div>
          <OwnerBookingForm hidden={{ serviceId: service.id, unitId: unit.id, resourceId: prof?.id ?? '', date, time: chosen.time }} askPartySize={service.askPartySize} />
        </section>
      )}
    </div>
  );
}
