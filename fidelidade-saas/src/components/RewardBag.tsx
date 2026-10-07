'use client';

import Link from 'next/link';
import { useActionState, useMemo, useState } from 'react';
import { redeemBagAction } from '@/app/actions/customer';
import { formatPoints } from '@/lib/points';
import { Icon } from './Icons';
import { RewardImage } from './Visual';

export type BagReward = { id: string; name: string; description: string | null; pointsCost: number; imageUrl: string | null };

/**
 * Vitrine de prêmios + sacola. O cliente monta a sacola com o que cabe nos seus pontos
 * e resgata tudo de uma vez; cada item vira um código para retirar no balcão.
 */
export function RewardBag({
  restaurantId,
  rewards,
  balance,
  remainingThisMonth,
  limit,
  hoursText,
}: {
  restaurantId: string;
  rewards: BagReward[];
  balance: number;
  remainingThisMonth: number;
  limit: number;
  hoursText: string | null;
}) {
  const [state, action, pending] = useActionState(redeemBagAction, {});
  const [qty, setQty] = useState<Record<string, number>>({});
  const [confirming, setConfirming] = useState(false);

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

  const left = balance - total;
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
      <div className="space-y-5">
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
            <li key={i} className="glass-panel-sm flex items-center justify-between gap-3 p-4">
              <span className="min-w-0 truncate font-bold text-slate-800">{c.name}</span>
              <span className="font-mono text-2xl font-bold tracking-[0.2em] text-electric-600">{c.code}</span>
            </li>
          ))}
        </ul>
        <Link href={`/carteira/${restaurantId}`} className="glass-button-ghost">Ver minha carteira</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="glass-panel flex items-center justify-between gap-3 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Seu saldo aqui</p>
          <p className="text-3xl font-extrabold text-primary">{formatPoints(balance)} <span className="text-base text-electric-600">pts</span></p>
        </div>
        <p className="max-w-[10rem] text-right text-xs text-slate-500">
          {remainingThisMonth > 0
            ? `Você ainda pode resgatar ${remainingThisMonth} ${remainingThisMonth === 1 ? 'item' : 'itens'} neste mês (limite de ${limit}).`
            : `Você atingiu o limite de ${limit} resgates neste mês.`}
        </p>
      </div>

      <ul className="space-y-3">
        {rewards.map((r) => {
          const q = qty[r.id] ?? 0;
          const canAdd = r.pointsCost <= left && itemsLeft > 0;
          const missing = r.pointsCost - balance;
          return (
            <li key={r.id} className="glass-panel-sm p-3">
              <div className="flex gap-3">
                <div className="relative shrink-0">
                  <RewardImage src={r.imageUrl} name={r.name} className="h-24 w-24 rounded-2xl" />
                  <span className="absolute bottom-1.5 left-1.5 rounded-md bg-slate-900/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Só pontos</span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="line-clamp-2 font-bold leading-snug text-slate-800">{r.name}</p>
                  {r.description && <p className="line-clamp-2 text-xs text-slate-500">{r.description}</p>}
                  <p className="mt-0.5 text-sm font-bold text-electric-600">{formatPoints(r.pointsCost)} pts</p>
                  {missing > 0 && q === 0 && <p className="text-xs text-slate-500">Faltam {formatPoints(missing)} pts</p>}
                  <div className="mt-auto flex justify-end pt-2">
                    {q === 0 ? (
                      <button type="button" disabled={!canAdd} onClick={() => add(r)} className="glass-button btn-sm" aria-label={`Adicionar ${r.name} à sacola`}>
                        Adicionar
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5" role="group" aria-label={`Quantidade de ${r.name}`}>
                        <button type="button" onClick={() => remove(r)} className="glass-button-ghost btn-sm !px-3" aria-label={`Remover um ${r.name}`}>−</button>
                        <span className="w-6 text-center font-bold text-slate-800" aria-live="polite">{q}</span>
                        <button type="button" disabled={!canAdd} onClick={() => add(r)} className="glass-button btn-sm !px-3" aria-label={`Adicionar mais um ${r.name}`}>+</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Sacola fixa acima da barra de abas */}
      {count > 0 && (
        <form action={action} className="fixed inset-x-0 bottom-24 z-20 mx-auto w-full max-w-md px-4">
          <input type="hidden" name="restaurantId" value={restaurantId} />
          <input type="hidden" name="items" value={JSON.stringify(Object.entries(qty).filter(([, n]) => n > 0).map(([rewardId, n]) => ({ rewardId, qty: n })))} />
          <div className="glass-panel space-y-3 p-4 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 font-bold text-primary">
                <Icon name="bag" size={20} /> Sua sacola · {count} {count === 1 ? 'item' : 'itens'}
              </p>
              <p className="text-right text-sm">
                <span className="font-extrabold text-slate-900">{formatPoints(total)} pts</span>
                <span className="block text-xs text-slate-500">sobram {formatPoints(left)} pts</span>
              </p>
            </div>
            {state.error && <p role="alert" className="glass-error">{state.error}</p>}
            {!confirming ? (
              <button type="button" onClick={() => setConfirming(true)} className="glass-button">Resgatar sacola</button>
            ) : (
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirming(false)} className="glass-button-ghost !w-auto">Voltar</button>
                <button type="submit" disabled={pending} className="glass-button">
                  {pending ? 'Resgatando…' : `Confirmar (${formatPoints(total)} pts)`}
                </button>
              </div>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
