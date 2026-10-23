'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { saveMenuItem, saveOrderSettings } from '@/app/actions/menu';
import { PREP_OPTIONS, prepText } from '@/lib/orders';
import { Icon } from './Icons';
import { ImageUpload } from './ImageUpload';
import { FormMessage, SubmitButton } from './ui';

export type MenuItemDefaults = {
  id?: string;
  name: string;
  description: string;
  category: string;
  price: string; // "28,00"
  promo: string; // "" = sem promoção
  featured: boolean;
  imageUrl: string | null;
  spotlight: boolean;
  offerEnds: string; // "2026-10-19T23:59" (Brasília) ou ""
  offerStock: string; // "" = sem limite
};

const EMPTY: MenuItemDefaults = { name: '', description: '', category: '', price: '', promo: '', featured: false, imageUrl: null, spotlight: false, offerEnds: '', offerStock: '' };

/** Cadastro e edição de um item do cardápio (com `item.id` edita). A foto vem do computador ou da busca na web. */
export function MenuItemForm({ item = EMPTY, categories, onDone }: { item?: MenuItemDefaults; categories: string[]; onDone?: () => void }) {
  const [state, action] = useActionState(saveMenuItem, {});
  const uid = item.id ?? 'novo';
  useEffect(() => {
    if (state.ok && onDone) onDone();
  }, [state.ok, onDone]);
  const v = state.values ?? {};
  return (
    <form action={action} className="space-y-3" key={state.ok && !item.id ? state.ok : 'idle'}>
      {item.id && <input type="hidden" name="id" value={item.id} />}
      <ImageUpload name="imageData" label="Foto do produto" hint="Com foto o produto vende bem mais." currentUrl={item.imageUrl} maxSide={800} webSearch />
      <div>
        <label className="glass-label" htmlFor={`m-name-${uid}`}>Nome</label>
        <input id={`m-name-${uid}`} name="name" defaultValue={v.name ?? item.name} className="glass-input" placeholder="Ex.: Açaí com Ninho e Avelã 300 ml" required maxLength={80} />
      </div>
      <div>
        <label className="glass-label" htmlFor={`m-desc-${uid}`}>Descrição <span className="font-normal text-slate-500">(opcional)</span></label>
        <input id={`m-desc-${uid}`} name="description" defaultValue={v.description ?? item.description} className="glass-input" placeholder="Ingredientes, tamanho…" maxLength={200} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="glass-label" htmlFor={`m-price-${uid}`}>Preço (R$)</label>
          <input id={`m-price-${uid}`} name="price" defaultValue={v.price ?? item.price} inputMode="decimal" className="glass-input" placeholder="28,00" required />
        </div>
        <div>
          <label className="glass-label" htmlFor={`m-promo-${uid}`}>Preço promocional <span className="font-normal text-slate-500">(opcional)</span></label>
          <input id={`m-promo-${uid}`} name="promo" defaultValue={v.promo ?? item.promo} inputMode="decimal" className="glass-input" placeholder="15,90" />
        </div>
        <div>
          <label className="glass-label" htmlFor={`m-cat-${uid}`}>Categoria</label>
          <input id={`m-cat-${uid}`} name="category" list={`m-cats-${uid}`} defaultValue={v.category ?? item.category} className="glass-input" placeholder="Clássicos" maxLength={30} />
          <datalist id={`m-cats-${uid}`}>{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
      </div>
      <p className="text-xs text-slate-500">Com preço promocional, o cliente vê o preço normal riscado e paga o promocional, e o produto entra em <b>Promoções de hoje</b> na tela Lugares do app. Itens da mesma categoria aparecem juntos no cardápio.</p>
      <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
        <legend className="px-1 text-sm font-bold text-slate-800">Oferta por tempo ou estoque limitado <span className="font-normal text-slate-500">(opcional)</span></legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="glass-label" htmlFor={`m-ends-${uid}`}>Termina em</label>
            <input id={`m-ends-${uid}`} name="offerEnds" type="datetime-local" defaultValue={v.offerEnds ?? item.offerEnds} className="glass-input" />
          </div>
          <div>
            <label className="glass-label" htmlFor={`m-stock-${uid}`}>Unidades na oferta</label>
            <input id={`m-stock-${uid}`} name="offerStock" type="number" min={1} inputMode="numeric" defaultValue={v.offerStock ?? item.offerStock} className="glass-input" placeholder="Ex.: 40" />
          </div>
        </div>
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input type="checkbox" name="spotlight" defaultChecked={item.spotlight} className="mt-0.5 h-4 w-4 rounded accent-electric-500" />
          <span><span className="block font-semibold text-slate-800">Também mostrar o cartão grande na lista de Lugares</span><span className="block text-xs text-slate-500">Além de “Promoções de hoje”, aparece um cartão grande com o prazo e “restam N” junto do seu lugar. Um por vez.</span></span>
        </label>
        <p className="text-xs text-slate-500">Com prazo e unidades, o cliente vê “restam N” e até quando vale. Acabou o prazo ou o estoque, o produto volta sozinho ao preço normal e sai de “Promoções de hoje”. Precisa do preço promocional.</p>
      </fieldset>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm has-[:checked]:border-electric-500 has-[:checked]:bg-[#F3F6FD]">
        <input type="checkbox" name="featured" defaultChecked={item.featured} className="mt-0.5 h-4 w-4 rounded accent-electric-500" />
        <span><span className="block font-semibold text-slate-800">Destaque da casa</span><span className="block text-xs text-slate-500">Aparece primeiro, em cartão grande. Só um produto por vez.</span></span>
      </label>
      <FormMessage state={state} />
      <div className="flex gap-2">
        <SubmitButton pendingText="Salvando…" variant={item.id ? 'primary' : 'ghost'} className={item.id ? 'btn-sm' : ''}>{item.id ? 'Salvar alterações' : 'Adicionar ao cardápio'}</SubmitButton>
        {onDone && <button type="button" className="glass-button-ghost btn-sm" onClick={onDone}>Cancelar</button>}
      </div>
    </form>
  );
}

/** Liga ou desliga os pedidos pelo app e define o tempo de preparo que o cliente vê. */
export function OrderSettingsForm({ defaults }: { defaults: { ordersEnabled: boolean; orderPrepMin: number } }) {
  const [state, action] = useActionState(saveOrderSettings, {});
  return (
    <form action={action} className="space-y-4">
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 has-[:checked]:border-electric-500 has-[:checked]:bg-[#F3F6FD]">
        <input type="checkbox" name="ordersEnabled" defaultChecked={state.values ? state.values.ordersEnabled === 'on' : defaults.ordersEnabled} className="mt-0.5 h-4 w-4 rounded accent-electric-500" />
        <span>
          <span className="block font-bold text-slate-800">Receber pedidos pelo app</span>
          <span className="block text-sm text-slate-600">O cliente escolhe do cardápio, monta a sacola e retira no balcão. Você cobra no balcão como sempre; os pontos entram quando você marca o pedido como retirado.</span>
        </span>
      </label>
      <div className="sm:max-w-xs">
        <label className="glass-label" htmlFor="o-prep">Tempo de preparo mostrado ao cliente</label>
        <select id="o-prep" name="orderPrepMin" className="glass-input" defaultValue={state.values?.orderPrepMin ?? String(defaults.orderPrepMin)}>
          {PREP_OPTIONS.map((m) => <option key={m} value={m}>{prepText(m).replace('pronto em ', '')}</option>)}
        </select>
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Salvando…">Salvar</SubmitButton>
    </form>
  );
}

/** Atualiza a tela de pedidos sozinha, para o novo pedido aparecer sem o dono recarregar. */
export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}

/** Botão "Editar" que abre o formulário do item logo abaixo e fecha ao salvar. */
export function MenuItemEditor({ item, categories }: { item: MenuItemDefaults; categories: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button type="button" className="action-tile !w-auto px-4" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Icon name="cog" size={18} /> {open ? 'Fechar edição' : 'Editar'}
      </button>
      {open && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
          <MenuItemForm item={item} categories={categories} onDone={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
