import Link from 'next/link';
import { Icon } from '@/components/Icons';
import { RewardImage } from '@/components/Visual';
import { affordableRewards, pendingVouchers, usedRedemptions } from '@/lib/customer-rewards';
import { imageUrl } from '@/lib/images';
import { formatDateTimeBR, formatPoints, formatPrice } from '@/lib/points';
import { requireCustomer } from '@/lib/session';

export const metadata = { title: 'Meus prêmios' };
export const dynamic = 'force-dynamic';

const TABS = [
  ['retirar', 'Para retirar'],
  ['disponiveis', 'Posso resgatar'],
  ['resgatados', 'Já resgatados'],
] as const;
type Tab = (typeof TABS)[number][0];

export default async function MeusPremiosPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const customer = await requireCustomer('/perfil/premios');
  const raw = (await searchParams).aba;
  const tab: Tab = TABS.some(([k]) => k === raw) ? (raw as Tab) : 'retirar';

  const [vouchers, affordable, used] = await Promise.all([
    pendingVouchers(customer.id),
    affordableRewards(customer.id, { perPlace: 12 }),
    usedRedemptions(customer.id),
  ]);
  const counts: Record<Tab, number> = { retirar: vouchers.length, disponiveis: affordable.length, resgatados: used.length };

  return (
    <main className="space-y-5 p-4 sm:p-6 md:pt-8">
      <header>
        <Link href="/perfil" className="inline-flex items-center gap-1 text-sm font-semibold text-electric-600"><Icon name="back" size={16} /> Perfil</Link>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-primary">Meus prêmios</h1>
        <p className="text-sm text-slate-600">O que está esperando você no balcão, o que já dá para trocar e o que você já resgatou.</p>
      </header>

      <nav aria-label="Seus prêmios" className="chip-row">
        {TABS.map(([key, label]) => (
          <Link key={key} href={`/perfil/premios?aba=${key}`} aria-current={tab === key ? 'page' : undefined} className={`chip-link shrink-0 gap-1.5 ${tab === key ? 'chip-link-active' : ''}`}>
            {label}
            <span className="rounded-full bg-slate-100 px-1.5 text-xs font-bold text-slate-600">{counts[key]}</span>
          </Link>
        ))}
      </nav>

      {tab === 'retirar' &&
        (vouchers.length === 0 ? (
          <p className="glass-panel-sm p-4 text-sm text-slate-600">Nenhum prêmio esperando retirada. Quando você resgatar, o código aparece aqui.</p>
        ) : (
          <ul className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
            {vouchers.map((v) => (
              <li key={v.id}>
                <Link href={`/carteira/${v.restaurant.id}`} className="glass-panel-sm card-link flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-800">{v.rewardName}</p>
                    <p className="truncate text-xs text-slate-500">{v.restaurant.name} · mostre este código no balcão</p>
                    <p className="text-xs text-slate-400">Pedido em {formatDateTimeBR(v.createdAt)}</p>
                  </div>
                  <span className="font-mono text-xl font-bold tracking-[0.18em] text-electric-600">{v.code}</span>
                </Link>
              </li>
            ))}
          </ul>
        ))}

      {tab === 'disponiveis' &&
        (affordable.length === 0 ? (
          <p className="glass-panel-sm p-4 text-sm text-slate-600">
            Ainda não dá para trocar nada com o seu saldo. <Link href="/lugares" className="link-inline">Veja os prêmios dos lugares</Link> e junte pontos.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {affordable.map((r) => (
              <li key={r.id}>
                <Link href={`/lugar/${r.place.id}/premios`} className="glass-panel-sm card-link block h-full overflow-hidden">
                  <RewardImage src={imageUrl(r.imageId)} name={r.name} className="h-28 w-full" />
                  <div className="space-y-0.5 p-3">
                    <p className="truncate text-sm font-bold text-slate-800">{r.name}</p>
                    <p className="truncate text-xs text-slate-500">{r.place.name}</p>
                    <p className="text-sm font-semibold text-electric-600">{formatPrice(r.pointsCost, r.cashCents)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ))}

      {tab === 'resgatados' &&
        (used.length === 0 ? (
          <p className="glass-panel-sm p-4 text-sm text-slate-600">Você ainda não retirou nenhum prêmio. Quando o balcão entregar, ele passa a aparecer aqui.</p>
        ) : (
          <ul className="glass-panel-sm divide-y divide-slate-200/70">
            {used.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 p-4 text-sm">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-semibold text-slate-800"><Icon name="check" size={15} className="text-emerald-600" />{r.rewardName}</p>
                  <p className="text-xs text-slate-500">
                    {r.restaurant.name}{r.usedUnit ? ` · ${r.usedUnit.name}` : ''} · {formatDateTimeBR(r.usedAt ?? r.createdAt)}
                  </p>
                </div>
                <span className="shrink-0 text-right font-bold text-slate-600">{formatPrice(r.pointsCost, r.cashCents)}</span>
              </li>
            ))}
          </ul>
        ))}
    </main>
  );
}
