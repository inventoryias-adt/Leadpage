import Link from 'next/link';
import { removeMenuItem, setMenuItemActive } from '@/app/actions/menu';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icons';
import { MenuItemEditor, MenuItemForm, OrderSettingsForm } from '@/components/MenuForms';
import { RewardImage } from '@/components/Visual';
import { prisma } from '@/lib/db';
import { imageUrl } from '@/lib/images';
import { hasPromo, offerEndText, offerEndToInput, promoPct, unitPrice } from '@/lib/orders';
import { formatBRL } from '@/lib/points';
import { requireActiveRestaurant } from '@/lib/session';

export const metadata = { title: 'Cardápio' };
export const dynamic = 'force-dynamic';

const brInput = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

export default async function CardapioPage() {
  const restaurant = await requireActiveRestaurant();
  const items = await prisma.menuItem.findMany({ where: { restaurantId: restaurant.id }, orderBy: [{ category: 'asc' }, { createdAt: 'asc' }] });
  const categories = [...new Set(items.map((i) => i.category))];
  const open = await prisma.order.count({ where: { restaurantId: restaurant.id, status: { in: ['RECEIVED', 'PREPARING', 'READY'] } } });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="glass-panel p-5 sm:p-7">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-primary">Cardápio e pedidos pelo app</h1>
          <Link href="/dashboard/pedidos" className="glass-button-ghost btn-sm !w-auto">
            <Icon name="bag" size={16} /> Ver pedidos{open > 0 ? ` (${open})` : ''}
          </Link>
        </div>
        <p className="mb-4 text-sm text-slate-500">Seus clientes pedem pelo app e retiram no balcão. Você cobra no balcão como sempre e, ao marcar como retirado, os pontos entram sozinhos.</p>
        <OrderSettingsForm defaults={{ ordersEnabled: restaurant.ordersEnabled, orderPrepMin: restaurant.orderPrepMin }} />
      </section>

      <section className="glass-panel p-5 sm:p-7">
        <h2 className="mb-1 font-bold text-primary">Produtos do cardápio</h2>
        <p className="mb-4 text-sm text-slate-500">Diferente dos prêmios (que o cliente troca por pontos), estes são vendidos em reais.</p>

        {items.length === 0 ? (
          <EmptyState compact variant="gift" title="Seu cardápio está vazio" text="Adicione o primeiro produto abaixo. Depois ligue os pedidos para os clientes verem." />
        ) : (
          <ul className="mb-5 space-y-3">
            {items.map((i) => (
              <li key={i.id} className={`glass-inset p-3 ${i.active ? '' : 'opacity-70'}`}>
                <div className="flex gap-3">
                  <RewardImage src={imageUrl(i.imageId)} name={i.name} className="h-20 w-20 shrink-0 rounded-2xl" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug text-slate-800 [overflow-wrap:anywhere]">{i.name}</p>
                    {i.description && <p className="line-clamp-2 text-xs text-slate-500">{i.description}</p>}
                    <p className="mt-1 text-sm font-bold text-primary">
                      {formatBRL(unitPrice(i))}
                      {hasPromo(i) && <span className="ml-2 text-xs font-medium text-slate-400 line-through">{formatBRL(i.priceCents)}</span>}
                      {hasPromo(i) && <span className="ml-2 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700">−{promoPct(i)}%</span>}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className="glass-chip">{i.category}</span>
                      {i.featured && <span className="glass-chip">Destaque da casa</span>}
                      {i.spotlight && <span className="glass-chip">Oferta em Lugares</span>}
                      {i.offerEndsAt && <span className="glass-chip">{i.offerEndsAt > new Date() ? offerEndText(i.offerEndsAt) : 'Oferta encerrada'}</span>}
                      {i.offerStock != null && <span className="glass-chip">{i.offerStock > 0 ? `restam ${i.offerStock}` : 'Estoque da oferta esgotado'}</span>}
                      {!i.active && <span className="glass-chip">Pausado</span>}
                    </div>
                  </div>
                  <form action={removeMenuItem} className="shrink-0">
                    <input type="hidden" name="id" value={i.id} />
                    <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-slate-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600" aria-label={`Remover ${i.name}`} title="Remover">
                      <Icon name="trash" size={18} />
                    </button>
                  </form>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <MenuItemEditor
                    categories={categories}
                    item={{ id: i.id, name: i.name, description: i.description ?? '', category: i.category, price: brInput(i.priceCents), promo: i.promoCents ? brInput(i.promoCents) : '', featured: i.featured, imageUrl: imageUrl(i.imageId), spotlight: i.spotlight, offerEnds: i.offerEndsAt && i.offerEndsAt > new Date() ? offerEndToInput(i.offerEndsAt) : '', offerStock: i.offerStock != null ? String(i.offerStock) : '' }}
                  />
                  <form action={setMenuItemActive} className="mt-3">
                    <input type="hidden" name="id" value={i.id} />
                    <input type="hidden" name="active" value={i.active ? '0' : '1'} />
                    <button className="action-tile !w-auto px-4">{i.active ? 'Pausar (acabou)' : 'Voltar a vender'}</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="rounded-xl border border-dashed border-slate-300 p-4">
          <h3 className="mb-3 text-sm font-bold text-slate-800">Novo produto</h3>
          <MenuItemForm categories={categories} />
        </div>
      </section>
    </div>
  );
}
