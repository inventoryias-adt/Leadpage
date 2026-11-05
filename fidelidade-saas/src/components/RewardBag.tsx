'use client';

import Link from 'next/link';
import { useActionState, useMemo, useState } from 'react';
import { redeemBagAction } from '@/app/actions/customer';
import { formatPoints, formatPrice } from '@/lib/points';
import { Icon } from './Icons';
import { VoucherTicket } from './VoucherTicket';
import { RewardImage } from './Visual';

export type SharedInfo = { total: number; places: { name: string; points: number; equiv: number }[] };
export type BagReward = { id: string; name: string; description: string | null; pointsCost: number; cashCents: number; imageUrl: string | null };

/**
 * Vitrine de prêmios + sacola. O cliente monta a sacola com o que cabe nos seus pontos
 * e resgata tudo de uma vez; cada item vira um código para retirar no balcão.
 */
export function RewardBag({
  restaurantId,
  placeName,
  rewards,
  balance,
  remainingThisMonth,
  limit,
  hoursText,
  shared,
}: {
  restaurantId: string;
  placeName: string;
  rewards: BagReward[];
  balance: number;
  remainingThisMonth: number;
  limit: number;
  hoursText: string | null;
  shared?: SharedInfo | null;
}) {
  const [state, action, pending] = useActionState(redeemBagAction, {});
  const [qty, setQty] = useState<Record<string, number>>({});
  const [confirming, setConfirming] = useState(false);
  const [useShared, setUseShared] = useState(false);
  const available = balance + (useShared && shared ? shared.total : 0); // saldo daqui + o que as outras carteiras rendem

  const { count, total } = useMemo(() => {
    let c = 0;
    let t = 0;
    for (const r of rewards) {
      const q = qty[r.id] ?? 0;
      c += q;
      t += q * r.pointsCost;
    }
    return { count: c, total: t };
  }, [qty, rewards]);

  const left = available - total;
  const itemsLeft = remainingThisMonth - count;

  const add = (r: BagReward) => {
    setConfirming(false);
    setQty((q) => ({ ...q, [r.id]: (q[r.id] ?? 0) + 1 }));
  };
  const remove = (r: BagReward) => {
    setConfirming(false);
    setQty((q) => ({ ...q, [r.id]: Math.max(0, (q[r.id] ?? 0) - 1) }));
  };

  if (state.codes?.length) {
    return (
      <div className="mx-auto max-w-xl space-y-5">
        <div className="glass-panel p-6 text-center">
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <Icon name="check" size={28} />
          </span>
          <h2 className="text-xl font-extrabold text-primary">Resgate realizado!</h2>
          <p className="mt-1 text-sm text-slate-600">Mostre {state.codes.length === 1 ? 'este código' : 'estes códigos'} no balcão para retirar.</p>
          {hoursText && <p className="mt-2 text-sm font-semibold text-slate-700">Horário para retirar: {hoursText}</p>}
        </div>
        <ul className="space-y-3">
          {state.codes.map((c, i) => (
            <li key={i}><VoucherTicket code={c.code} rewardName={c.name} placeName={placeName} /></li>
          ))}
        </ul>
        <div className="grid gap-2 sm:grid-cols-2">
          <Link href="/perfil/premios" className="glass-button-navy">Ver meus prêmios</Link>
          <Link href={`/carteira/${restaurantId}`} className="glass-button-ghost">Ver minha carteira</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 lg:grid lg:grid-cols-3 lg:items-start lg:gap-6 lg:space-y-0">
      <div className="space-y-5 lg:col-span-2">
      <div>
        <p className="micro">Seu saldo aqui</p>
        <p className="mt-1 text-[3.25rem] font-extrabold leading-none tracking-[-0.04em] text-primary">{formatPoints(balance)} <span className="text-[15px] font-semibold tracking-normal text-slate-500">seus pontos</span></p>
        <p className="sub mt-2">
          {remainingThisMonth > 0
            ? `Você ainda pode resgatar ${remainingThisMonth} ${remainingThisMonth === 1 ? 'item' : 'itens'} neste mês (limite de ${limit}).`
            : `Você atingiu o limite de ${limit} resgates neste mês.`}
        </p>
      </div>

      {shared && (
        <label className="glass-panel-sm flex cursor-pointer items-start gap-3 p-4">
          <input type="checkbox" className="mt-1 h-4 w-4 rounded accent-electric-500" checked={useShared} onChange={(e) => { setUseShared(e.target.checked); setConfirming(false); if (!e.target.checked) setQty({}); }} />
          <span className="min-w-0 text-sm">
            <span className="block font-bold text-slate-800">Completar com pontos de outros lugares (+{formatPoints(shared.total)} pts)</span>
            <span className="block text-xs text-slate-600">
              Só entra o que faltar. {shared.places.map((p) => `${p.name}: ${formatPoints(p.points)} pts valem ${formatPoints(p.equiv)} aqui`).join(' · ')}.
            </span>
          </span>
        </label>
      )}

      <ul className="divide-y divide-[#e6e8ec] border-y border-[#e6e8ec]">
        {rewards.map((r) => {
          const q = qty[r.id] ?? 0;
          const canAdd = r.pointsCost <= left && itemsLeft > 0;
          const missing = r.pointsCost - available;
          return (
            <li key={r.id} className="flex items-center gap-4 py-3.5">
              <RewardImage src={r.imageUrl} name={r.name} className="h-16 w-16 shrink-0 rounded-2xl" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[17px] font-semibold leading-snug text-primary">{r.name}</p>
                <p className={`text-sm font-semibold ${missing > 0 && q === 0 ? 'text-slate-500' : 'text-electric-600'}`}>
                  {formatPrice(r.pointsCost, r.cashCents)}
                  {r.cashCents > 0 && <span className="ml-1.5 font-medium text-slate-500">· R$ + pontos</span>}
                </p>
                {missing > 0 && q === 0 && <p className="text-xs italic text-slate-500">Faltam {formatPoints(missing)} pts</p>}
              </div>
              {q === 0 ? (
                <button type="button" disabled={!canAdd} onClick={() => add(r)} className="glass-button-navy btn-sm !w-auto shrink-0 !px-4 uppercase tracking-[0.12em] !text-[12px] disabled:opacity-35" aria-label={`Escolher ${r.name}`}>
                  Escolher
                </button>
              ) : (
                <div className="flex shrink-0 items-center gap-1.5" role="group" aria-label={`Quantidade de ${r.name}`}>
                  <button type="button" onClick={() => remove(r)} className="glass-button-ghost btn-sm !w-auto" aria-label={`Remover um ${r.name}`}>−</button>
                  <span className="w-6 text-center font-bold text-slate-800" aria-live="polite">{q}</span>
                  <button type="button" disabled={!canAdd} onClick={() => add(r)} className="glass-button btn-sm !w-auto" aria-label={`Adicionar mais um ${r.name}`}>+</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      </div>

      {/* Sacola: celular = fixa acima da barra de abas; computador = painel ao lado da lista */}
      {(
        <form
          action={action}
          className={`${count > 0 ? 'fixed inset-x-0 bottom-24 z-20 mx-auto w-full max-w-md px-4' : 'hidden'} lg:static lg:top-24 lg:mx-0 lg:block lg:max-w-none lg:px-0 lg:sticky`}
        >
          <input type="hidden" name="restaurantId" value={restaurantId} />
          <input type="hidden" name="useShared" value={useShared ? '1' : '0'} />
          <input type="hidden" name="items" value={JSON.stringify(Object.entries(qty).filter(([, n]) => n > 0).map(([rewardId, n]) => ({ rewardId, qty: n })))} />
          <div className="glass-panel space-y-3 p-4 shadow-2xl lg:shadow-none">
            {count === 0 ? (
              <div className="py-4 text-center">
                <Icon name="gift" size={28} className="mx-auto mb-2 text-slate-400" />
                <p className="font-bold text-slate-700">Você ainda não escolheu nenhum prêmio</p>
                <p className="text-sm text-slate-500">Toque em “Escolher” no prêmio que você quer trocar.</p>
              </div>
            ) : (
            <>
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 font-bold text-primary">
                <Icon name="gift" size={20} /> Prêmios escolhidos · {count}
              </p>
              <p className="text-right text-sm">
                <span className="font-extrabold text-slate-900">{formatPoints(total)} pts</span>
                <span className="block text-xs text-slate-500">{useShared && total > balance ? `${formatPoints(total - balance)} pts de outros lugares` : `sobram ${formatPoints(left)} pts`}</span>
              </p>
            </div>
            {state.error && <p role="alert" className="glass-error">{state.error}</p>}
            {!confirming ? (
              <button type="button" onClick={() => setConfirming(true)} className="glass-button">Trocar pontos pelos prêmios</button>
            ) : (
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirming(false)} className="glass-button-ghost !w-auto">Voltar</button>
                <button type="submit" disabled={pending} className="glass-button">
                  {pending ? 'Resgatando…' : `Confirmar (${formatPoints(total)} pts)`}
                </button>
              </div>
            )}
            </>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
