'use client';

import { useState } from 'react';
import { discountFor } from '@/lib/points-discount';
import { formatBRL, formatPoints } from '@/lib/points';

/**
 * "Usar meus pontos": o cliente escolhe quantos pontos gastar (até o máximo que o serviço aceita e o saldo permitem)
 * e vê na hora quanto fica a pagar. O servidor confere tudo de novo ao confirmar.
 */
export function PointsDiscountField({ priceCents, balance, rate, maxPoints, maxPct }: { priceCents: number; balance: number; rate: number; maxPoints: number; maxPct: number }) {
  const [on, setOn] = useState(false);
  const [points, setPoints] = useState(maxPoints);
  const step = Math.max(1, Math.floor(rate / 2)); // meio real por passo
  const used = on ? Math.min(points, maxPoints) : 0;
  const discount = Math.min(discountFor(used, rate), priceCents);

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <input type="hidden" name="usePoints" value={used} />
      <label className="flex items-start gap-3">
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="mt-0.5 h-5 w-5 rounded accent-electric-500" />
        <span className="text-sm text-slate-700">
          <span className="font-semibold">Usar meus pontos como desconto</span>
          <span className="block text-xs text-slate-500">Você tem {formatPoints(balance)} pontos aqui. Este serviço aceita até {maxPct}% do preço em pontos.</span>
        </span>
      </label>
      {on && (
        <div className="space-y-2">
          <input
            type="range"
            min={0}
            max={maxPoints}
            step={step}
            value={Math.min(points, maxPoints)}
            onChange={(e) => setPoints(Number(e.target.value))}
            className="w-full accent-electric-500"
            aria-label="Pontos a usar"
          />
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>{formatPoints(used)} pontos = {formatBRL(discount)} de desconto</span>
            <button type="button" className="link-inline" onClick={() => setPoints(maxPoints)}>Usar o máximo</button>
          </div>
        </div>
      )}
      <dl className="space-y-0.5 text-sm">
        <div className="flex justify-between text-slate-600"><dt>Valor do serviço</dt><dd>{formatBRL(priceCents)}</dd></div>
        {discount > 0 && <div className="flex justify-between text-emerald-700"><dt>Desconto com pontos</dt><dd>− {formatBRL(discount)}</dd></div>}
        <div className="flex justify-between font-bold text-primary"><dt>A pagar no local</dt><dd>{formatBRL(priceCents - discount)}</dd></div>
      </dl>
    </div>
  );
}
