'use client';

import { useActionState, useEffect, useState } from 'react';
import { removeBirthday, saveBirthday } from '@/app/actions/customer';
import { MONTH_NAMES, birthdayText } from '@/lib/birthday';
import { formatPoints } from '@/lib/points';
import { Icon } from './Icons';
import { FormMessage, SubmitButton } from './ui';

/**
 * "Informar aniversário": só dia e mês, opcional. Sem aniversário mostra o convite (com o presente do lugar, se houver);
 * com aniversário mostra a data e deixa alterar ou remover.
 */
export function BirthdayCard({ initial, giftPoints = 0, placeName }: { initial: { day: number; month: number } | null; giftPoints?: number; placeName?: string }) {
  const [saved, save] = useActionState(saveBirthday, {});
  const [removed, remove, removing] = useActionState(removeBirthday, {});
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initial);
  useEffect(() => {
    if (saved.ok) setOpen(false);
  }, [saved.ok]);
  // Depois de salvar ou remover, a tela mostra o novo estado sem esperar a página recarregar.
  const current = removed.ok ? null : value;

  return (
    <section aria-label="Aniversário" className="glass-panel-sm p-4" data-testid="birthday-card">
      {!open ? (
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#E8EEFB] text-electric-600"><Icon name="gift" size={22} /></span>
          <div className="min-w-0 flex-1">
            {current ? (
              <>
                <p className="font-bold text-slate-800">Seu aniversário: {birthdayText(current.day, current.month)}</p>
                {giftPoints > 0 && <p className="text-xs text-emerald-700">{placeName ? `${placeName} dá` : 'Dá'} {formatPoints(giftPoints)} pontos de presente no seu dia</p>}
              </>
            ) : (
              <>
                <p className="font-bold text-slate-800">Informar aniversário</p>
                <p className="text-xs italic text-slate-500">{giftPoints > 0 ? `Para a gente lembrar do seu dia · ganhe ${formatPoints(giftPoints)} pontos de presente` : 'Para a gente lembrar do seu dia'}</p>
              </>
            )}
          </div>
          <button type="button" onClick={() => setOpen(true)} className="glass-button-ghost btn-sm !w-auto" data-testid="birthday-open">{current ? 'Alterar' : 'Informar'}</button>
        </div>
      ) : (
        <form
          action={(fd) => {
            setValue({ day: Number(fd.get('birthDay')), month: Number(fd.get('birthMonth')) });
            save(fd);
          }}
          className="space-y-3"
        >
          <p className="font-bold text-slate-800">Qual é o seu aniversário?</p>
          <div className="grid grid-cols-[5rem_1fr] gap-3">
            <div>
              <label className="glass-label" htmlFor="b-day">Dia</label>
              <select id="b-day" name="birthDay" className="glass-input" defaultValue={current?.day ?? 1}>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="glass-label" htmlFor="b-month">Mês</label>
              <select id="b-month" name="birthMonth" className="glass-input" defaultValue={current?.month ?? 1}>
                {MONTH_NAMES.map((n, i) => <option key={n} value={i + 1}>{n[0].toUpperCase() + n.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <p className="text-xs text-slate-500">Só o dia e o mês, sem o ano. Você pode alterar ou apagar quando quiser.</p>
          <FormMessage state={saved} />
          <div className="flex flex-wrap gap-2">
            <SubmitButton pendingText="Salvando…" className="btn-sm !w-auto">Salvar</SubmitButton>
            <button type="button" onClick={() => setOpen(false)} className="glass-button-ghost btn-sm !w-auto">Cancelar</button>
            {current && (
              <button type="button" disabled={removing} onClick={() => { setOpen(false); remove(); }} className="glass-button-ghost btn-sm !w-auto text-red-600" data-testid="birthday-remove">Remover</button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
