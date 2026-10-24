'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LogoMark } from './Brand';
import { formatPoints } from '@/lib/points';

export type CardData = { name: string; code: string; since: string; balance: number };

/** Cantos arredondados em porcentagem (da largura e da altura do próprio cartão), para valer em qualquer tamanho. */
const RADIUS = '5.4% / 8.5%';
const GRAD = 'linear-gradient(135deg,#0B1B3A 0%,#16305F 52%,#0B1B3A 100%)';

/** Todas as medidas usam `cqw` (1% da largura do cartão): o mesmo desenho serve na tela do celular e na impressão (85,6 mm). */
const face = { containerType: 'inline-size', aspectRatio: '1.586 / 1', background: GRAD, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as const;

/** Frente: marca, chip, ID da conta em destaque, nome e saldo. */
export function CardFront({ data }: { data: CardData }) {
  return (
    <div className="card-face relative h-full w-full overflow-hidden text-white" style={{ ...face, borderRadius: RADIUS }}>
      <div aria-hidden className="card-deco absolute -right-[14cqw] -top-[22cqw] h-[70cqw] w-[70cqw] rounded-full" style={{ background: 'radial-gradient(circle,rgba(198,244,50,.34),rgba(198,244,50,0) 68%)' }} />
      <div aria-hidden className="card-deco absolute inset-0" style={{ background: 'linear-gradient(115deg,rgba(255,255,255,.13) 0%,rgba(255,255,255,0) 38%,rgba(255,255,255,0) 72%,rgba(255,255,255,.06) 100%)' }} />
      <div className="relative flex h-full flex-col justify-between" style={{ padding: '6cqw' }}>
        <div className="flex items-center justify-between">
          <span className="flex items-center" style={{ gap: '2.4cqw' }}>
            <LogoMark className="!h-[8.5cqw] !w-[8.5cqw]" />
            <span className="font-bold leading-none" style={{ fontSize: '6.2cqw', letterSpacing: '-0.04em' }}>fidelize</span>
          </span>
          <span className="font-bold uppercase opacity-70" style={{ fontSize: '2.5cqw', letterSpacing: '0.2em' }}>Cartão de pontos</span>
        </div>

        <div className="flex items-center" style={{ gap: '4cqw' }}>
          {/* chip decorativo */}
          <span aria-hidden className="relative block" style={{ width: '12cqw', height: '9cqw', borderRadius: '1.8cqw', background: 'linear-gradient(135deg,#E9F9A8,#C6F432 55%,#9BC21A)' }}>
            <span className="absolute inset-x-0 top-1/2 h-px bg-[#0B1B3A]/25" />
            <span className="absolute inset-y-0 left-1/3 w-px bg-[#0B1B3A]/25" />
            <span className="absolute inset-y-0 left-2/3 w-px bg-[#0B1B3A]/25" />
          </span>
          <span aria-hidden className="opacity-60" style={{ fontSize: '5cqw', letterSpacing: '-0.1em' }}>)))</span>
        </div>

        <div>
          <p className="font-bold uppercase opacity-60" style={{ fontSize: '2.3cqw', letterSpacing: '0.2em' }}>ID da conta</p>
          <p className="whitespace-nowrap font-mono font-bold text-lima" style={{ fontSize: '8cqw', letterSpacing: '0.12em', textShadow: '0 1px 0 rgba(0,0,0,.35), 0 0 14px rgba(198,244,50,.25)' }} data-testid="account-id-code">{data.code}</p>
        </div>

        <div className="flex items-end justify-between" style={{ gap: '4cqw' }}>
          <span className="min-w-0">
            <span className="block truncate font-semibold uppercase" style={{ fontSize: '3.7cqw', letterSpacing: '0.1em' }}>{data.name}</span>
            <span className="block opacity-60" style={{ fontSize: '2.5cqw', letterSpacing: '0.08em' }}>Membro desde {data.since}</span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block font-bold uppercase opacity-60" style={{ fontSize: '2.3cqw', letterSpacing: '0.2em' }}>Saldo</span>
            <span className="block whitespace-nowrap font-extrabold leading-none text-lima" style={{ fontSize: '6.4cqw' }} data-testid="card-balance">{formatPoints(data.balance)} <span className="font-semibold text-white/70" style={{ fontSize: '3cqw' }}>pts</span></span>
          </span>
        </div>
      </div>
    </div>
  );
}

/** Verso: tarja, como usar e onde usar. */
export function CardBack({ data }: { data: CardData }) {
  const steps = ['Informe o ID no caixa, no lugar do CPF.', 'Os pontos entram na carteira daquele lugar.', 'Troque por prêmios nos lugares onde você tem saldo.'];
  return (
    <div className="card-face relative h-full w-full overflow-hidden text-white" style={{ ...face, borderRadius: RADIUS }}>
      <div aria-hidden className="absolute inset-x-0 bg-black/80" style={{ top: '7cqw', height: '11cqw' }} />
      <div className="relative flex h-full flex-col" style={{ padding: '6cqw', paddingTop: '22cqw', gap: '3cqw' }}>
        <p className="font-bold uppercase text-lima" style={{ fontSize: '2.6cqw', letterSpacing: '0.2em' }}>Como usar</p>
        <ol className="space-y-[1.4cqw]" style={{ fontSize: '3.1cqw', lineHeight: 1.25 }}>
          {steps.map((t, i) => (
            <li key={t} className="flex" style={{ gap: '2cqw' }}>
              <span className="shrink-0 rounded-full bg-lima text-center font-extrabold text-[#0B1B3A]" style={{ width: '4.4cqw', height: '4.4cqw', lineHeight: '4.4cqw', fontSize: '2.8cqw' }}>{i + 1}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
        <p className="mt-auto flex items-center justify-between opacity-70" style={{ fontSize: '2.5cqw' }}>
          <span>Vale em todos os lugares do clube Fidelize</span>
          <span className="font-mono font-bold tracking-widest">{data.code}</span>
        </p>
      </div>
    </div>
  );
}

/** Cartão que vira ao toque: frente (saldo e ID) e verso (como usar). */
export function MemberCard({ data }: { data: CardData }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <section aria-label="Seu cartão Fidelize" data-testid="account-id" className="mx-auto w-full max-w-[26rem]" style={{ perspective: '1400px' }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setFlipped((f) => !f)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFlipped((f) => !f); } }}
        aria-pressed={flipped}
        aria-label={flipped ? 'Cartão Fidelize, verso com instruções. Toque para ver a frente' : `Cartão Fidelize, ID ${data.code}, saldo ${formatPoints(data.balance)} pontos. Toque para ver como usar`}
        data-testid="card-flip"
        className="relative block w-full cursor-pointer text-left shadow-[0_18px_40px_rgba(11,27,58,.32)] outline-none transition-transform duration-700 focus-visible:ring-4 focus-visible:ring-electric-500/40 motion-reduce:transition-none"
        style={{ aspectRatio: '1.586 / 1', transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'none', borderRadius: RADIUS }}
      >
        <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}><CardFront data={data} /></div>
        <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}><CardBack data={data} /></div>
      </div>
      <p className="mt-2 text-center text-xs text-slate-500">{flipped ? 'Toque no cartão para voltar à frente' : 'Toque no cartão para ver como usar'}</p>
    </section>
  );
}

/** Frente e verso para imprimir (85,6 × 54 mm cada), fora da tela: o resto da página é escondido pelo CSS de impressão (`.print-portal`). */
export function PrintCard({ data }: { data: CardData }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div className="print-portal print-cards" aria-hidden>
      <div className="pc-sheet">
        <div className="pc-card"><CardFront data={{ ...data }} /></div>
        <div className="pc-card"><CardBack data={data} /></div>
        <p className="pc-note">Recorte as duas faces. Guarde o cartão ou fotografe: o que vale é o ID da conta.</p>
      </div>
    </div>,
    document.body,
  );
}
