import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { BookingForm } from '@/components/BookingForm';
import { LiveRefresh } from '@/components/LiveRefresh';
import { RescheduleForm } from '@/components/RescheduleForm';
import { joinWaitingList, leaveWaitingList } from '@/app/actions/booking';
import { AlternativeSlots, SlotHoldBanner } from '@/components/SlotHoldBanner';
import { Icon } from '@/components/Icons';
import { PlaceAvatar } from '@/components/Visual';
import { imageUrl } from '@/lib/images';
import { WAIT_PERIODS, addDaysKey, bookingPoints, canCustomerCancel, dayOccupancy, formatBookingWhen, parseDateKey, slotHref, todayKey, weekdayOf } from '@/lib/booking';
import { alternativeSlots, ensureDefaultService, firstFreeSlots, slotsForDay, staffFor, waitPosition } from '@/lib/booking-db';
import { prisma } from '@/lib/db';
import { DAY_SHORT, parseSchedule } from '@/lib/hours';
import { formatBRL, formatPoints } from '@/lib/points';
import { resourceColor } from '@/lib/palette';
import { maxDiscount } from '@/lib/points-discount';
import { getCustomer } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Agendar' };

type SP = { servico?: string; unidade?: string; data?: string; hora?: string; prof?: string; reagendar?: string; espera?: string; erro?: string };

export default async function AgendarPage({ params, searchParams }: { params: Promise<{ restaurantId: string }>; searchParams: Promise<SP> }) {
  const { restaurantId } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(restaurantId)) notFound();

  const customer = await getCustomer();
  const [restaurant, firstServices, units] = await Promise.all([
    prisma.restaurant.findUnique({ where: { id: restaurantId } }),
    prisma.service.findMany({ where: { restaurantId, active: true }, orderBy: { createdAt: 'asc' } }),
    prisma.unit.findMany({ where: { restaurantId, active: true }, orderBy: { createdAt: 'asc' } }),
  ]);
  if (!restaurant || restaurant.subscriptionStatus !== 'ACTIVE' || !restaurant.onboardedAt) notFound();
  // Categoria que atende com hora marcada, ainda sem serviços: oferece o serviço padrão.
  const services = firstServices.length === 0 && (await ensureDefaultService(restaurant))
    ? await prisma.service.findMany({ where: { restaurantId, active: true }, orderBy: { createdAt: 'asc' } })
    : firstServices;

  const base = `/lugar/${restaurantId}/agendar`;
  const back = (
    <Link href={`/lugar/${restaurantId}`} className="inline-flex items-center gap-1 text-sm font-semibold text-electric-600"><Icon name="back" size={16} /> {restaurant.name}</Link>
  );

  if (services.length === 0 || units.length === 0) {
    return (
      <main className="space-y-5 p-4 sm:p-6 md:pt-8">
        {back}
        <h1 className="text-2xl font-extrabold tracking-tight text-primary">Agendar</h1>
        <p className="glass-panel-sm p-4 text-sm text-slate-600">Este lugar ainda não recebe agendamentos pelo app.</p>
      </main>
    );
  }

  // Reagendar: o serviço e a unidade são os do agendamento; o cliente só escolhe novo dia, horário e profissional.
  if (sp.reagendar && !customer) redirect(`/entrar?next=${encodeURIComponent(`${base}?reagendar=${sp.reagendar}`)}`);
  const rb =
    sp.reagendar && customer && /^[0-9a-f-]{36}$/.test(sp.reagendar)
      ? await prisma.booking.findFirst({ where: { id: sp.reagendar, customerId: customer.id, restaurantId, status: { in: ['PENDING', 'CONFIRMED'] } }, include: { resource: { select: { name: true } } } })
      : null;
  if (sp.reagendar && (!rb || !rb.serviceId || !rb.unitId || !services.some((s) => s.id === rb.serviceId) || !units.some((u) => u.id === rb.unitId))) {
    return (
      <main className="space-y-5 p-4 sm:p-6 md:pt-8">
        {back}
        <h1 className="text-2xl font-extrabold tracking-tight text-primary">Reagendar</h1>
        <p role="alert" className="glass-error">Não foi possível remarcar este agendamento: ele já foi encerrado ou o serviço não está mais disponível.</p>
        <Link href="/perfil/agendamentos" className="glass-button-navy">Ver meus agendamentos</Link>
      </main>
    );
  }
  if (rb && !canCustomerCancel(rb, restaurant.bookingCancelHours)) {
    return (
      <main className="space-y-5 p-4 sm:p-6 md:pt-8">
        {back}
        <h1 className="text-2xl font-extrabold tracking-tight text-primary">Reagendar</h1>
        <p role="alert" className="glass-error">O prazo para remarcar pelo app já passou. Fale com o lugar.</p>
        <Link href="/perfil/agendamentos" className="glass-button-navy">Ver meus agendamentos</Link>
      </main>
    );
  }
  const service = rb ? services.find((s) => s.id === rb.serviceId) ?? null : services.find((s) => s.id === sp.servico) ?? null;
  const unit = rb ? units.find((u) => u.id === rb.unitId) ?? units[0] : units.find((u) => u.id === sp.unidade) ?? units[0];
  const url = (over: Partial<SP>) => {
    const q = new URLSearchParams();
    const merged = { servico: service?.id, unidade: units.length > 1 ? unit.id : undefined, data: sp.data, prof: sp.prof, reagendar: rb?.id, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };

  // Passo 1: escolher o serviço.
  if (!service) {
    return (
      <main className="space-y-5 p-4 sm:p-6 md:pt-8">
        {back}
        <header>
          <h1 className="text-2xl font-extrabold tracking-tight text-primary">Agendar</h1>
          <p className="text-sm text-slate-600">O que você quer marcar?</p>
        </header>
        <ul className="space-y-3">
          {services.map((s) => (
            <li key={s.id}>
              <Link href={`${base}?servico=${s.id}`} className="glass-panel card-link flex items-center gap-3 !rounded-[20px] p-4">
                <span className="icon-tile"><Icon name="clock" size={20} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-slate-800">{s.name}</p>
                  {s.description && <p className="truncate text-xs text-slate-500">{s.description}</p>}
                  <p className="text-xs text-slate-500">{s.durationMin} min{s.priceCents > 0 ? ` · ${formatBRL(s.priceCents)}` : ''}{s.pointsDiscountMaxPct > 0 && s.priceCents > 0 ? ' · aceita pontos' : ''}</p>
                </div>
                <Icon name="chevron" size={18} className="text-slate-400" />
              </Link>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  // Passo 2: dia e horário.
  const now = new Date();
  const today = todayKey(now);
  const wanted = sp.data && parseDateKey(sp.data) ? sp.data : today;
  const maxKey = addDaysKey(today, restaurant.bookingMaxDaysAhead);
  const date = wanted < today ? today : wanted > maxKey ? maxKey : wanted;
  const schedule = parseSchedule(unit.openingSchedule);
  const staff = await staffFor(prisma, { restaurantId, service, unitId: unit.id });
  const prof = staff.find((p) => p.id === sp.prof) ?? null; // quem o cliente escolheu (vazio = qualquer)
  const { slots } = await slotsForDay(prisma, { restaurantId, policy: restaurant, service, unit, date, now, resourceId: prof?.id, ignoreBookingId: rb?.id, customerId: customer?.id });
  const days = Array.from({ length: Math.min(14, restaurant.bookingMaxDaysAhead + 1) }, (_, i) => addDaysKey(today, i));
  const chosen = sp.hora ? slots.find((s) => s.time === sp.hora) ?? null : null;
  const dayArgs = { restaurantId, policy: restaurant, service, unit, resourceId: prof?.id, customerId: customer?.id, ignoreBookingId: rb?.id };
  // Atalho para quem não quer escolher: o primeiro horário livre dos próximos dias. Se o horário pedido na URL sumiu, já oferece saídas.
  const nextFree = !sp.hora ? (await firstFreeSlots(prisma, { ...dayArgs, from: today, days: 14, limit: 1 }))[0] ?? null : null;
  const lost = sp.hora && !chosen ? await alternativeSlots(prisma, { ...dayArgs, date, time: sp.hora, limit: 3 }) : null;
  const hrefBase = url({ data: undefined, hora: undefined });
  // Lista de espera: dia que o lugar atende mas sem horário livre. Quem já pediu vê a posição na fila.
  const dayOpen = dayOccupancy({ date, schedule, resources: prof ? [prof] : staff, bookings: [], timeOffs: [] }).capacityMin > 0;
  const waitEntry = customer && !rb ? await prisma.waitlistEntry.findFirst({ where: { customerId: customer.id, restaurantId, serviceId: service.id, date, status: 'WAITING' } }) : null;
  const waitAt = waitEntry ? await waitPosition(waitEntry) : 0;
  const waitFields = { restaurantId, serviceId: service.id, unitId: unit.id, resourceId: prof?.id ?? '', date };
  const label = (key: string, i: number) => (i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : DAY_SHORT[weekdayOf(key)]);
  const points = bookingPoints(service.priceCents, restaurant.pointsPerReal);
  const wallet = customer && service.pointsDiscountMaxPct > 0 && service.priceCents > 0 ? await prisma.wallet.findUnique({ where: { customerId_restaurantId: { customerId: customer.id, restaurantId } } }) : null;
  const balance = wallet?.balance ?? 0;
  const discount = maxDiscount({ priceCents: service.priceCents, maxPct: service.pointsDiscountMaxPct, rate: restaurant.pointsPerRealOff, balance });

  return (
    <main className="space-y-5 p-4 sm:p-6 md:pt-8">
      {back}
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-primary">{rb ? 'Reagendar' : 'Agendar'}</h1>
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-slate-600">
          <span className="font-semibold text-slate-800">{service.name}</span> · {service.durationMin} min{service.priceCents > 0 ? ` · ${formatBRL(service.priceCents)}` : ''}
          {!rb && <Link href={url({ servico: undefined, hora: undefined })} className="link-inline text-xs">trocar</Link>}
        </p>
        {rb && (
          <p className="mt-2 flex flex-wrap items-center gap-2 rounded-2xl bg-[#EAF0FF] px-4 py-3 text-sm text-primary" data-testid="reschedule-current">
            <Icon name="clock" size={18} className="text-electric-600" />
            <span>Horário atual: <b>{formatBookingWhen(rb.startsAt)}</b>{rb.resource ? <> com <b>{rb.resource.name}</b></> : null}. Escolha o novo dia, horário e profissional.</span>
          </p>
        )}
        {!rb && points > 0 && <p className="mt-1.5"><span className="chip-lima">Ao concluir você ganha {formatPoints(points)} pontos aqui</span></p>}
        {!rb && service.pointsDiscountMaxPct > 0 && service.priceCents > 0 && <p className="mt-1.5"><span className="glass-chip">Aceita pontos como desconto, até {service.pointsDiscountMaxPct}% do preço.</span></p>}
      </header>

      {units.length > 1 && !rb && (
        <nav aria-label="Unidade" className="chip-row">
          {units.map((u) => (
            <Link key={u.id} href={url({ unidade: u.id, hora: undefined })} aria-current={u.id === unit.id ? 'true' : undefined} className={`chip-link shrink-0 ${u.id === unit.id ? 'chip-link-active' : ''}`}>
              <Icon name="pin" size={14} className="mr-1" /> {u.name}
            </Link>
          ))}
        </nav>
      )}

      {(staff.length > 1 || staff.some((p) => p.photoImageId)) && (
        <section aria-labelledby="quem">
          <h2 id="quem" className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Com quem?</h2>
          <ul className="chip-row">
            <li className="shrink-0">
              <Link href={url({ prof: undefined, hora: undefined })} aria-current={!prof ? 'true' : undefined} className={`chip-link h-full ${!prof ? 'chip-link-active' : ''}`}>Qualquer um</Link>
            </li>
            {staff.map((p) => {
              const tone = resourceColor(p);
              const on = prof?.id === p.id;
              return (
                <li key={p.id} className="shrink-0">
                  <Link href={url({ prof: p.id, hora: undefined })} aria-current={on ? 'true' : undefined} className="chip-link gap-2 !py-1" style={on ? { background: tone.hex, borderColor: tone.hex, color: '#fff' } : { background: tone.soft, borderColor: tone.soft, color: tone.hex }}>
                    <span className="rounded-full ring-2" style={{ '--tw-ring-color': tone.hex } as React.CSSProperties}><PlaceAvatar name={p.name} src={imageUrl(p.photoImageId)} size={28} /></span> {p.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="dia">
        <h2 id="dia" className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Escolha o dia</h2>
        <ul className="chip-row">
          {days.map((key, i) => {
            const wd = weekdayOf(key);
            const unitOpen = !!schedule && schedule.find((d) => d.day === wd)?.closed === false;
            const staffWorks = (prof ? [prof] : staff).some((p) => !p.schedule || p.schedule.find((d) => d.day === wd)?.closed === false);
            const closed = !unitOpen || !staffWorks;
            const day = Number(key.slice(8));
            const on = key === date;
            return (
              <li key={key} className="shrink-0">
                {closed ? (
                  <span className="flex w-14 flex-col items-center rounded-2xl border border-slate-200 bg-slate-50 py-2 text-slate-300" aria-label={`${label(key, i)} ${day}: fechado`}>
                    <span className="text-[11px] font-semibold">{label(key, i)}</span>
                    <span className="text-lg font-bold">{day}</span>
                  </span>
                ) : (
                  <Link href={url({ data: key, hora: undefined })} aria-current={on ? 'date' : undefined} className={`flex w-14 flex-col items-center rounded-2xl border py-2 ${on ? 'border-electric-600 bg-electric-600 text-white shadow-md' : 'border-slate-200 bg-white text-slate-700 hover:border-electric-500'}`}>
                    <span className="text-[11px] font-semibold">{label(key, i)}</span>
                    <span className="text-lg font-bold">{day}</span>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
        {restaurant.bookingMaxDaysAhead > 13 && (
          <form method="get" action={base} className="mt-3 flex flex-wrap items-end gap-2">
            {service && <input type="hidden" name="servico" value={service.id} />}
            {units.length > 1 && <input type="hidden" name="unidade" value={unit.id} />}
            <div>
              <label className="glass-label" htmlFor="bk-date">Outra data</label>
              <input id="bk-date" name="data" type="date" min={today} max={maxKey} defaultValue={date} className="glass-input !w-auto" />
            </div>
            <button className="glass-button-ghost btn-sm">Ver horários</button>
          </form>
        )}
      </section>

      {sp.espera === 'ok' && <p role="status" className="glass-success">Pronto! Você está na lista de espera. Avisamos no app assim que abrir um horário.</p>}
      {sp.espera === 'saiu' && <p role="status" className="glass-success">Você saiu da lista de espera.</p>}
      {sp.erro && <p role="alert" className="glass-error">{sp.erro}</p>}
      <LiveRefresh />
      <section aria-labelledby="hora">
        <h2 id="hora" className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Horários de {formatBookingWhen(new Date(`${date}T15:00:00Z`)).split(' às ')[0]}</h2>
        {nextFree && (
          <Link href={slotHref(hrefBase, nextFree)} data-testid="next-free" className="mb-3 flex items-center justify-between gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white">
            <span className="flex items-center gap-2"><Icon name="clock" size={16} /> Próximo horário livre</span>
            <span className="text-lime-300">{formatBookingWhen(new Date(`${nextFree.date}T${nextFree.time}:00-03:00`))}</span>
          </Link>
        )}
        {lost && (
          <div role="alert" data-testid="slot-lost" className="mb-3 space-y-3 rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200">
            <p className="text-sm font-semibold text-amber-900">Esse horário não está mais livre.</p>
            <AlternativeSlots hrefBase={hrefBase} options={lost} />
          </div>
        )}
        {slots.length === 0 ? (
          <p className="glass-panel-sm p-4 text-sm text-slate-600">Sem horários livres neste dia. Escolha outro dia.</p>
        ) : (
          <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {slots.map((s) => (
              <li key={s.time}>
                <Link href={url({ data: date, hora: s.time })} aria-current={chosen?.time === s.time ? 'true' : undefined} className={`block rounded-xl border py-2.5 text-center text-sm font-semibold ${chosen?.time === s.time ? 'border-[#0F1F3D] bg-[#0F1F3D] text-lima' : 'border-slate-200 bg-white text-slate-800 hover:border-electric-500'}`}>
                  {s.time}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {waitEntry && (
        <section aria-labelledby="espera" data-testid="waitlist-on" className="space-y-3 rounded-[22px] bg-[#EAF0FF] p-4">
          <div>
            <h2 id="espera" className="flex items-center gap-2 text-base font-bold text-primary"><Icon name="bell" size={18} className="text-electric-600" /> Você está na lista de espera</h2>
            <p className="text-sm text-slate-700">{WAIT_PERIODS[waitEntry.period as keyof typeof WAIT_PERIODS] ?? 'Qualquer horário'} · {waitAt}º da fila neste dia. Avisamos no app assim que abrir um horário; quem confirmar primeiro fica com ele.</p>
          </div>
          <form action={leaveWaitingList}>
            <input type="hidden" name="id" value={waitEntry.id} />
            <input type="hidden" name="back" value={url({ data: date, hora: undefined })} />
            <button className="btn-danger btn-sm">Sair da lista</button>
          </form>
        </section>
      )}
      {!waitEntry && !rb && slots.length === 0 && dayOpen && (
        <section aria-labelledby="espera" data-testid="waitlist-offer" className="space-y-3 rounded-[22px] border border-dashed border-electric-500/50 bg-white p-4">
          <div>
            <h2 id="espera" className="flex items-center gap-2 text-base font-bold text-primary"><Icon name="bell" size={18} className="text-electric-600" /> Dia lotado? Entre na lista de espera</h2>
            <p className="text-sm text-slate-600">Se alguém cancelar ou remarcar, você é avisado no app e pode pegar o horário antes dos outros.</p>
          </div>
          {customer ? (
            <form action={joinWaitingList} className="flex flex-wrap items-end gap-2">
              {Object.entries(waitFields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
              <div>
                <label className="glass-label" htmlFor="wait-period">Qual faixa de horário?</label>
                <select id="wait-period" name="period" className="glass-input !w-auto" defaultValue="ANY">
                  {Object.entries(WAIT_PERIODS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
              </div>
              <button className="glass-button-navy btn-sm" data-testid="waitlist-join">Avisar-me se abrir</button>
            </form>
          ) : (
            <Link href={`/entrar?next=${encodeURIComponent(url({ data: date }))}`} className="glass-button-navy btn-sm">Entrar para pedir aviso</Link>
          )}
        </section>
      )}

      {chosen && (
        <section aria-labelledby="confirmar" className="glass-panel space-y-4 !rounded-[22px] p-4">
          <div>
            <h2 id="confirmar" className="text-lg font-bold text-primary">{rb ? 'Confirmar novo horário' : 'Confirmar'}</h2>
            <p className="text-sm text-slate-700">
              <strong>{service.name}</strong> em <strong>{formatBookingWhen(chosen.startsAt)}</strong>
              {units.length > 1 ? <> · {unit.name}</> : null}
            </p>
            <p className="text-xs text-slate-500">{unit.address ?? restaurant.name} · pagamento no local</p>
            {(() => {
              const free = staff.filter((p) => chosen.resourceIds.includes(p.id));
              const who = prof ?? (free.length === 1 ? free[0] : null);
              const dur = who ? chosen.durationByResource[who.id] : null;
              return (
                <div className="mt-2 space-y-2">
                  {who ? (
                    <p className="flex items-center gap-2 text-sm text-slate-700">
                      <PlaceAvatar name={who.name} src={imageUrl(who.photoImageId)} size={32} /> com <strong>{who.name}</strong>{dur ? <span className="text-xs text-slate-500">· {dur} min</span> : null}
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-slate-500">Livres neste horário (toque para escolher quem atende, ou deixe que o lugar escolhe):</p>
                      <ul className="flex flex-wrap gap-2">
                        {free.map((p) => (
                          <li key={p.id}>
                            <Link href={url({ prof: p.id, data: date, hora: chosen.time })} className="chip-link gap-2 !py-1"><PlaceAvatar name={p.name} src={imageUrl(p.photoImageId)} size={24} /> {p.name} <span className="text-xs text-slate-400">{chosen.durationByResource[p.id]} min</span></Link>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              );
            })()}
          </div>
          {rb && customer ? (
            <RescheduleForm bookingId={rb.id} date={date} time={chosen.time} resourceId={prof?.id ?? ''} />
          ) : customer ? (
            <>
              <SlotHoldBanner params={{ restaurantId, serviceId: service.id, unitId: unit.id, date, time: chosen.time, resourceId: prof?.id ?? '' }} hrefBase={hrefBase} />
              <BookingForm hrefBase={hrefBase} hidden={{ restaurantId, serviceId: service.id, unitId: unit.id, date, time: chosen.time, resourceId: prof?.id ?? '' }} askPartySize={service.askPartySize} discount={{ priceCents: service.priceCents, balance, rate: restaurant.pointsPerRealOff, maxPoints: discount.maxPoints, maxPct: service.pointsDiscountMaxPct }} />
            </>
          ) : (
            <Link href={`/entrar?next=${encodeURIComponent(url({ data: date, hora: chosen.time }))}`} className="glass-button-navy w-full">Entrar para confirmar</Link>
          )}
        </section>
      )}
    </main>
  );
}
