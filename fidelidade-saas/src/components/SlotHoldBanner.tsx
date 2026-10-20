'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { holdBookingSlot } from '@/app/actions/booking';
import { formatBookingWhen, formatCountdown, slotHref } from '@/lib/booking';
import type { HoldState, SlotOption } from '@/lib/form';
import { Icon } from './Icons';

type Params = { restaurantId: string; serviceId: string; unitId: string; date: string; time: string; resourceId: string };

const HOLD_MS = 5 * 60_000;

export function AlternativeSlots({ hrefBase, options }: { hrefBase: string; options: SlotOption[] }) {
  if (options.length === 0) return <p className="text-sm text-slate-600">Não há outros horários livres nos próximos dias. Tente outro profissional ou volte mais tarde.</p>;
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-primary">Horários livres mais próximos:</p>
      <ul className="flex flex-wrap gap-2">
        {options.map((o) => (
          <li key={`${o.date}${o.time}`}>
            <Link href={slotHref(hrefBase, o)} data-testid="alt-slot" className="chip-link gap-1.5">
              <Icon name="clock" size={14} /> {formatBookingWhen(new Date(`${o.date}T${o.time}:00-03:00`))}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Ao abrir o "Confirmar", segura o horário para o cliente por 5 minutos (ele some da lista dos outros) e mostra a contagem.
 * Se alguém pegou antes, já mostra os horários mais próximos. Vencida a reserva, ele ainda pode tentar confirmar se ninguém pegou.
 */
export function SlotHoldBanner({ params, hrefBase }: { params: Params; hrefBase: string }) {
  const [state, setState] = useState<HoldState | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const key = `${params.restaurantId}|${params.serviceId}|${params.unitId}|${params.date}|${params.time}|${params.resourceId}`;

  async function hold() {
    setState(null);
    setLeft(null);
    const result = await holdBookingSlot(params);
    setState(result);
    if (result.ok) setLeft(new Date(result.expiresAt).getTime() - Date.now());
  }

  useEffect(() => {
    let alive = true;
    holdBookingSlot(params).then((result) => {
      if (!alive) return;
      setState(result);
      if (result.ok) setLeft(new Date(result.expiresAt).getTime() - Date.now());
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!state || !state.ok) return;
    const end = new Date(state.expiresAt).getTime();
    const id = setInterval(() => setLeft(end - Date.now()), 1000);
    return () => clearInterval(id);
  }, [state]);

  if (!state) return <p role="status" className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-600">Reservando o horário para você…</p>;

  if (!state.ok && state.gone) {
    return (
      <div role="alert" data-testid="hold-gone" className="space-y-3 rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200">
        <p className="flex items-center gap-2 text-sm font-semibold text-amber-900"><Icon name="clock" size={16} /> Alguém acabou de fechar esse horário.</p>
        <AlternativeSlots hrefBase={hrefBase} options={state.alternatives ?? []} />
      </div>
    );
  }
  if (!state.ok) return <p role="alert" className="glass-error">{state.error}</p>;

  if (left !== null && left <= 0) {
    return (
      <div role="status" data-testid="hold-expired" className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">
        <span>A reserva de 5 minutos acabou. Ainda dá para confirmar se ninguém pegou.</span>
        <button type="button" onClick={hold} className="link-inline font-semibold">Reservar de novo</button>
      </div>
    );
  }
  const remaining = left ?? HOLD_MS;
  return (
    <div role="status" data-testid="hold-active" className="space-y-2 rounded-2xl bg-lime-100/70 px-3 py-2.5 ring-1 ring-lime-300">
      <p className="flex items-center justify-between gap-2 text-sm font-semibold text-primary">
        <span className="flex items-center gap-1.5"><Icon name="lock" size={15} /> Horário reservado para você</span>
        <span data-testid="hold-timer" className="tabular-nums">{formatCountdown(remaining)}</span>
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-lime-200"><div className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear" style={{ width: `${Math.min(100, (remaining / HOLD_MS) * 100)}%` }} /></div>
    </div>
  );
}
