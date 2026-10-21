'use client';

import { useEffect, useState } from 'react';
import { Icon } from './Icons';

type Choice = { value: string; label: string };
type Person = { id: string; name: string; hasPhone: boolean };

/**
 * "Enviar pelo WhatsApp": abre uma janela para escolher o período (dia, semana, mês), o atendente (ou todos) e para quem mandar.
 * O envio é um formulário que abre o WhatsApp em outra aba (o servidor monta o texto com o que foi escolhido).
 */
export function WhatsappSend({ date, period, personId, periods, people }: { date: string; period: string; personId: string; periods: Choice[]; people: Person[] }) {
  const [open, setOpen] = useState(false);
  const [per, setPer] = useState(period);
  const [prof, setProf] = useState(personId);
  const [para, setPara] = useState<'atendente' | 'escolher'>('atendente');
  const person = people.find((p) => p.id === prof) ?? null;
  const canSendToPerson = !!person?.hasPhone;

  useEffect(() => {
    if (!open) return;
    setPer(period);
    setProf(personId);
    setPara('atendente');
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, period, personId]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="glass-button btn-sm" data-testid="whatsapp-abrir" aria-haspopup="dialog">
        <Icon name="whatsapp" size={15} /> <span className="sm:hidden">WhatsApp</span><span className="hidden sm:inline">Enviar pelo WhatsApp</span>
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Enviar agenda pelo WhatsApp" data-testid="whatsapp-janela" className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center">
          <button type="button" aria-label="Fechar" onClick={() => setOpen(false)} className="absolute inset-0 bg-slate-900/45" />
          <form method="get" action="/dashboard/agenda/whatsapp" target="_blank" onSubmit={() => { setTimeout(() => setOpen(false), 400); }} className="relative w-full max-w-md space-y-4 rounded-[26px] bg-white p-5 shadow-2xl">
            <div>
              <h2 className="text-lg font-bold text-primary">Enviar agenda pelo WhatsApp</h2>
              <p className="text-sm text-slate-600">Escolha o que entra na mensagem. Cancelados ficam de fora.</p>
            </div>
            <input type="hidden" name="data" value={date} />
            <div>
              <label htmlFor="wa-per" className="glass-label">Período</label>
              <select id="wa-per" name="per" value={per} onChange={(e) => setPer(e.target.value)} className="glass-input">
                {periods.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="wa-prof" className="glass-label">Atendente</label>
              <select id="wa-prof" name="prof" value={prof} onChange={(e) => { setProf(e.target.value); setPara('atendente'); }} className="glass-input">
                <option value="">Todos os atendentes</option>
                {people.map((p) => <option key={p.id} value={p.id}>Só {p.name}</option>)}
              </select>
            </div>
            {person && (
              <fieldset className="space-y-2">
                <legend className="glass-label">Enviar para</legend>
                <label className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${canSendToPerson ? 'border-slate-200' : 'border-slate-100 text-slate-400'}`}>
                  <input type="radio" name="para" value="atendente" checked={canSendToPerson && para === 'atendente'} disabled={!canSendToPerson} onChange={() => setPara('atendente')} className="mt-0.5" />
                  <span><b className="text-slate-800">{person.name}</b>{canSendToPerson ? ' (número cadastrado)' : ' não tem WhatsApp cadastrado'}</span>
                </label>
                <label className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm">
                  <input type="radio" name="para" value="escolher" checked={!canSendToPerson || para === 'escolher'} onChange={() => setPara('escolher')} className="mt-0.5" />
                  <span><b className="text-slate-800">Outro contato</b>, que eu escolho no WhatsApp (por exemplo, eu mesmo)</span>
                </label>
              </fieldset>
            )}
            {!person && <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">A agenda de todos vai numa mensagem só. No WhatsApp você escolhe quem recebe (pode ser você mesmo).</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setOpen(false)} className="glass-button-ghost flex-1">Cancelar</button>
              <button className="glass-button-navy flex-1" data-testid="whatsapp-enviar"><Icon name="whatsapp" size={16} /> Abrir no WhatsApp</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
