'use client';

import Link from 'next/link';
import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { placeOrderAction } from '@/app/actions/orders';
import { MAX_NOTE, MAX_QTY_PER_ITEM, hasPromo, orderPoints, prepText, promoPct, unitPrice } from '@/lib/orders';
import { formatBRL, formatPoints } from '@/lib/points';
import { Icon } from './Icons';
import { PlaceAvatar, RewardImage } from './Visual';

export type MenuView = { id: string; name: string; description: string | null; priceCents: number; promoCents: number | null; imageUrl: string | null };
export type MenuGroup = { name: string; items: MenuView[] };
export type PickupUnit = { id: string; name: string; address: string | null };

type Step = 'menu' | 'bag' | 'receive';

/** O preço de um item: o que se paga, e o cheio riscado quando há promoção. */
function Price({ item, className = '' }: { item: MenuView; className?: string }) {
  return (
    <span className={className}>
      <span className="font-extrabold text-slate-900">{formatBRL(unitPrice(item))}</span>
      {hasPromo(item) && <span className="ml-2 text-sm font-medium text-slate-400 line-through">{formatBRL(item.priceCents)}</span>}
    </span>
  );
}

function Stepper({ qty, name, onMinus, onPlus, canPlus }: { qty: number; name: string; onMinus: () => void; onPlus: () => void; canPlus: boolean }) {
  return (
    <div className="flex items-center rounded-full bg-slate-100" role="group" aria-label={`Quantidade de ${name}`}>
      <button type="button" onClick={onMinus} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-700 hover:bg-slate-200" aria-label={qty === 1 ? `Remover ${name} da sacola` : `Tirar um ${name}`}>
        {qty === 1 ? <Icon name="trash" size={17} /> : <span className="text-xl leading-none">−</span>}
      </button>
      <span className="w-7 text-center font-bold text-slate-900" aria-live="polite">{qty}</span>
      <button type="button" onClick={onPlus} disabled={!canPlus} className="flex h-9 w-9 items-center justify-center rounded-full text-xl leading-none text-slate-700 hover:bg-slate-200 disabled:opacity-40" aria-label={`Adicionar mais um ${name}`}>+</button>
    </div>
  );
}

/**
 * Cardápio do lugar + sacola + escolha da retirada. O cliente monta a sacola, revê, escolhe onde retira e confirma;
 * paga no balcão. O servidor refaz preços e total na hora de confirmar (o navegador só manda "quais itens e quantos").
 */
export function OrderMenu({
  restaurantId,
  placeName,
  logoUrl,
  open,
  prepMin,
  units,
  initialUnitId,
  loggedIn,
  pointsPerReal,
  featured,
  groups,
  backHref,
}: {
  restaurantId: string;
  placeName: string;
  logoUrl: string | null;
  open: boolean | null;
  prepMin: number;
  units: PickupUnit[];
  initialUnitId: string | null;
  loggedIn: boolean;
  pointsPerReal: number;
  featured: MenuView | null;
  groups: MenuGroup[];
  backHref: string;
}) {
  const [state, action, pending] = useActionState(placeOrderAction, {});
  const [qty, setQty] = useState<Record<string, number>>({});
  const [step, setStep] = useState<Step>('menu');
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [unitId, setUnitId] = useState(initialUnitId ?? units[0]?.id ?? '');
  const storageKey = `bag:${restaurantId}`;
  const restored = useRef(false);

  const all = useMemo(() => [...(featured ? [featured] : []), ...groups.flatMap((g) => g.items)], [featured, groups]);
  const byId = useMemo(() => new Map(all.map((i) => [i.id, i])), [all]);

  // A sacola sobrevive a um "Entrar" no meio do caminho: guarda no navegador e restaura uma única vez, ao abrir a página.
  const byIdRef = useRef(byId);
  byIdRef.current = byId;
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? '{}') as Record<string, number>;
      const ok: Record<string, number> = {};
      for (const [id, n] of Object.entries(saved)) if (byIdRef.current.has(id) && Number.isFinite(n) && n > 0) ok[id] = Math.min(MAX_QTY_PER_ITEM, Math.floor(n));
      if (Object.keys(ok).length) setQty(ok);
    } catch {}
    restored.current = true;
  }, [storageKey]);

  const lines = useMemo(() => all.filter((i) => (qty[i.id] ?? 0) > 0).map((i) => ({ item: i, qty: qty[i.id] })), [all, qty]);
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const total = lines.reduce((n, l) => n + unitPrice(l.item) * l.qty, 0);
  const points = orderPoints(total, pointsPerReal);

  const add = (id: string) => setQty((q) => ({ ...q, [id]: Math.min(MAX_QTY_PER_ITEM, (q[id] ?? 0) + 1) }));
  const sub = (id: string) =>
    setQty((q) => {
      const next = { ...q, [id]: (q[id] ?? 0) - 1 };
      if (next[id] <= 0) delete next[id];
      return next;
    });

  const order = state.order;
  // Pedido feito: limpa a sacola guardada (e o efeito abaixo deixa de gravar).
  useEffect(() => {
    if (order) {
      try {
        sessionStorage.removeItem(storageKey);
      } catch {}
    }
  }, [order, storageKey]);
  useEffect(() => {
    if (!restored.current || order) return; // antes de restaurar ou depois do pedido feito, não grava
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(qty));
    } catch {}
  }, [qty, order, storageKey]);

  // Esc fecha a folha; com a folha aberta a página de trás não rola.
  useEffect(() => {
    if (step === 'menu' || order) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setStep('menu');
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [step, order]);

  const chosen = units.find((u) => u.id === unitId) ?? units[0];
  const here = `/lugar/${restaurantId}/pedido`;

  if (order) {
    return (
      <div className="mx-auto max-w-xl space-y-5 p-4 sm:p-6">
        <div className="glass-panel p-6 text-center" data-testid="order-done">
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <Icon name="check" size={28} />
          </span>
          <h1 className="text-xl font-extrabold text-primary">Pedido enviado!</h1>
          <p className="mt-1 text-sm text-slate-600">{placeName} já recebeu. Mostre este código no balcão, {prepText(order.prepMin)}.</p>
          <p className="my-4 font-mono text-4xl font-bold tracking-[0.3em] text-electric-600" data-testid="order-code">{order.code}</p>
          <p className="text-sm font-semibold text-slate-700">Pague {formatBRL(order.totalCents)} no balcão ao retirar.</p>
          {points > 0 && <p className="mt-1 text-xs text-slate-500">Você ganha {formatPoints(orderPoints(order.totalCents, pointsPerReal))} pontos quando retirar.</p>}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Link href="/perfil/pedidos" className="glass-button">Acompanhar meu pedido</Link>
          <Link href={backHref} className="glass-button-ghost">Voltar ao lugar</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={count > 0 ? 'pb-40' : 'pb-8'}>
      <div className="space-y-6 p-4 sm:p-6 md:pt-8">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm font-semibold text-electric-600 hover:text-primary">
          <Icon name="back" size={16} /> {placeName}
        </Link>

        {/* Cabeçalho do lugar */}
        <section className="glass-panel p-4">
          <div className="flex items-center gap-3.5">
            <PlaceAvatar name={placeName} src={logoUrl} size={56} />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-extrabold tracking-tight text-slate-900">{placeName}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
                {open != null && <span className={`font-semibold ${open ? 'text-emerald-700' : 'text-slate-500'}`}>● {open ? 'Aberto' : 'Fechado agora'}</span>}
                <span className="flex items-center gap-1"><Icon name="clock" size={14} /> {prepMin} min</span>
                <span className="flex items-center gap-1"><Icon name="bag" size={14} /> retirada grátis</span>
              </div>
            </div>
          </div>
          {open === false && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">O lugar está fechado agora, mas você já pode deixar o pedido enviado. Ele só começa a ser preparado quando abrir.</p>}
        </section>

        {/* Destaque da casa */}
        {featured && (
          <section aria-labelledby="destaque">
            <h2 id="destaque" className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Destaque da casa</h2>
            <article className="glass-panel overflow-hidden" data-testid="menu-featured">
              {featured.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={featured.imageUrl} alt={featured.name} className="h-40 w-full bg-slate-100 object-cover sm:h-52" />
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-extrabold leading-snug text-slate-900">{featured.name}</h3>
                  {hasPromo(featured) && <span className="shrink-0 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">−{promoPct(featured)}%</span>}
                </div>
                {featured.description && <p className="mt-1 line-clamp-3 text-sm text-slate-600">{featured.description}</p>}
                <div className="mt-3 flex items-center justify-between gap-3">
                  <Price item={featured} className="text-2xl" />
                  <AddControl id={featured.id} name={featured.name} qty={qty[featured.id] ?? 0} add={add} sub={sub} />
                </div>
              </div>
            </article>
          </section>
        )}

        {/* Categorias */}
        {groups.map((g) => (
          <section key={g.name} aria-label={g.name}>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{g.name}</h2>
            <ul className="space-y-3">
              {g.items.map((i) => (
                <li key={i.id} className="glass-panel-sm flex gap-3 p-3" data-testid="menu-item">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="font-bold leading-snug text-slate-900 [overflow-wrap:anywhere]">{i.name}</p>
                    {i.description && <p className="line-clamp-2 text-sm text-slate-500">{i.description}</p>}
                    <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                      <Price item={i} />
                      <AddControl id={i.id} name={i.name} qty={qty[i.id] ?? 0} add={add} sub={sub} />
                    </div>
                  </div>
                  <RewardImage src={i.imageUrl} name={i.name} className="h-24 w-24 shrink-0 self-start rounded-2xl" />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* Barra da sacola, acima das abas do app */}
      {count > 0 && step === 'menu' && (
        <div className="fixed inset-x-0 bottom-24 z-20 mx-auto w-full max-w-md px-4">
          <div className="glass-panel flex items-center gap-3 p-3 shadow-2xl">
            <PlaceAvatar name={placeName} src={logoUrl} size={44} />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500">Total com retirada</p>
              <p className="font-extrabold text-slate-900" data-testid="bag-total">{formatBRL(total)} <span className="text-sm font-medium text-slate-500">/ {count} {count === 1 ? 'item' : 'itens'}</span></p>
            </div>
            <button type="button" onClick={() => setStep('bag')} className="glass-button !w-auto px-5" data-testid="open-bag">Ver pedido</button>
          </div>
        </div>
      )}

      {/* Folha: sacola e retirada */}
      {step !== 'menu' && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 md:items-center md:p-6" onClick={() => setStep('menu')}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sheet-title"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[92vh] w-full max-w-md animate-fade-in flex-col rounded-t-[28px] bg-white shadow-2xl md:rounded-[28px]"
          >
            <div className="flex items-start justify-between gap-3 px-5 pt-5">
              <div className="min-w-0">
                {step === 'bag' ? (
                  <>
                    <h2 id="sheet-title" className="text-2xl font-extrabold tracking-tight text-primary">Sua sacola<span className="text-electric-500">.</span></h2>
                    <p className="truncate text-sm italic text-slate-500">{placeName} · {count} {count === 1 ? 'item' : 'itens'}</p>
                  </>
                ) : (
                  <h2 id="sheet-title" className="text-2xl font-extrabold tracking-tight text-primary">Como você quer receber<span className="text-electric-500">?</span></h2>
                )}
              </div>
              <button type="button" onClick={() => setStep('menu')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200" aria-label="Fechar">✕</button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {step === 'bag' ? (
                <>
                  <ul className="divide-y divide-slate-100">
                    {lines.map(({ item, qty: q }) => (
                      <li key={item.id} className="flex gap-3 py-3" data-testid="bag-line">
                        <RewardImage src={item.imageUrl} name={item.name} className="h-16 w-16 shrink-0 rounded-xl" />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold leading-snug text-slate-900">{item.name}</p>
                          <Price item={item} className="text-sm" />
                        </div>
                        <Stepper qty={q} name={item.name} onMinus={() => sub(item.id)} onPlus={() => add(item.id)} canPlus={q < MAX_QTY_PER_ITEM} />
                      </li>
                    ))}
                  </ul>
                  {noteOpen ? (
                    <div className="mt-3">
                      <label htmlFor="o-note" className="glass-label">Observação para o lugar</label>
                      <textarea id="o-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={MAX_NOTE} rows={2} className="glass-input" placeholder="Ex.: sem granola, colher extra" />
                    </div>
                  ) : (
                    <button type="button" onClick={() => setNoteOpen(true)} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-electric-600 hover:text-primary">
                      <Icon name="plus" size={16} /> {note ? 'Editar observação' : 'Observação'}
                    </button>
                  )}
                  {points > 0 && (
                    <p className="mt-4 flex items-center justify-between rounded-xl bg-[#F3F6FD] px-4 py-3 text-sm">
                      <span className="flex items-center gap-2 text-slate-700"><Icon name="gift" size={16} /> Você ganha nesse pedido</span>
                      <strong className="text-emerald-600" data-testid="bag-points">+{formatPoints(points)} pts</strong>
                    </p>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <ul className="space-y-2" aria-label="Onde retirar">
                    {(units.length > 0 ? units : []).map((u) => {
                      const on = u.id === chosen?.id;
                      return (
                        <li key={u.id}>
                          <button
                            type="button"
                            onClick={() => setUnitId(u.id)}
                            aria-pressed={on}
                            className={`flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition-colors ${on ? 'border-primary bg-[#F3F6FD]' : 'border-slate-200 hover:border-slate-300'}`}
                          >
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700"><Icon name="bag" size={22} /></span>
                            <span className="min-w-0 flex-1">
                              <span className="block font-extrabold text-slate-900">Retirada{units.length > 1 ? ` · ${u.name}` : ''}</span>
                              <span className="block text-sm italic text-slate-500">{[u.address, prepText(prepMin)].filter(Boolean).join(' · ')}</span>
                            </span>
                            <span className="font-extrabold text-primary">grátis</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">Você paga <strong>{formatBRL(total)}</strong> no balcão, na hora de retirar. Mostre o código do pedido.</p>
                  {state.error && <p role="alert" className="glass-error">{state.error}</p>}
                </div>
              )}
            </div>

            {/* Rodapé da folha */}
            <form action={action} className="flex items-center gap-3 border-t border-slate-100 px-5 py-4">
              <input type="hidden" name="restaurantId" value={restaurantId} />
              <input type="hidden" name="unitId" value={chosen?.id ?? ''} />
              <input type="hidden" name="note" value={note} />
              <input type="hidden" name="items" value={JSON.stringify(lines.map((l) => ({ menuItemId: l.item.id, qty: l.qty })))} />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-500">Total com retirada</p>
                <p className="font-extrabold text-slate-900">{formatBRL(total)} <span className="text-sm font-medium text-slate-500">/ {count} {count === 1 ? 'item' : 'itens'}</span></p>
              </div>
              {step === 'bag' ? (
                // key próprio: sem ele o React reaproveita este mesmo botão como o "Confirmar" (type=submit) no meio do toque e o pedido sairia sem passar pela retirada
                <button key="continue" type="button" onClick={() => setStep('receive')} disabled={count === 0} className="glass-button !w-auto px-6" data-testid="bag-continue">
                  Continuar <Icon name="chevron" size={16} />
                </button>
              ) : loggedIn ? (
                <button key="confirm" type="submit" disabled={pending || count === 0 || !chosen} className="glass-button !w-auto px-6" data-testid="order-confirm">
                  {pending ? 'Enviando…' : 'Confirmar pedido'}
                </button>
              ) : (
                <Link href={`/entrar?next=${encodeURIComponent(here)}`} className="glass-button !w-auto px-6">Entrar para pedir</Link>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/** "Adicionar" vira o contador depois do primeiro toque. */
function AddControl({ id, name, qty, add, sub }: { id: string; name: string; qty: number; add: (id: string) => void; sub: (id: string) => void }) {
  if (qty === 0) {
    return (
      <button type="button" onClick={() => add(id)} className="glass-button btn-sm !w-auto" aria-label={`Adicionar ${name} à sacola`}>
        Adicionar
      </button>
    );
  }
  return <Stepper qty={qty} name={name} onMinus={() => sub(id)} onPlus={() => add(id)} canPlus={qty < MAX_QTY_PER_ITEM} />;
}
