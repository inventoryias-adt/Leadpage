import Link from 'next/link';
import { Icon } from '@/components/Icons';
import { prisma } from '@/lib/db';
import { formatDateTimeBR, formatPoints } from '@/lib/points';
import { requireCustomer } from '@/lib/session';

export const metadata = { title: 'Histórico de pontos' };
export const dynamic = 'force-dynamic';

export default async function HistoricoPontosPage({ searchParams }: { searchParams: Promise<{ lugar?: string }> }) {
  const customer = await requireCustomer('/perfil/pontos');
  const wallets = await prisma.wallet.findMany({
    where: { customerId: customer.id },
    select: { id: true, balance: true, restaurant: { select: { id: true, name: true } } },
    orderBy: { balance: 'desc' },
  });
  const wanted = (await searchParams).lugar;
  const active = wallets.find((w) => w.restaurant.id === wanted);

  const history = await prisma.transaction.findMany({
    where: { wallet: { customerId: customer.id, ...(active ? { id: active.id } : {}) } },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { wallet: { select: { restaurant: { select: { name: true } } } } },
  });

  return (
    <main className="space-y-5 p-4 sm:p-6 md:pt-8">
      <header>
        <Link href="/perfil" className="inline-flex items-center gap-1 text-sm font-semibold text-electric-600"><Icon name="back" size={16} /> Perfil</Link>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-primary">Histórico de pontos</h1>
        <p className="text-sm text-slate-600">Tudo o que você ganhou e usou, do mais recente para o mais antigo.</p>
      </header>

      {wallets.length > 1 && (
        <nav aria-label="Filtrar por lugar" className="chip-row">
          <Link href="/perfil/pontos" className={`chip-link shrink-0 ${!active ? 'chip-link-active' : ''}`} aria-current={!active ? 'true' : undefined}>Todos</Link>
          {wallets.map((w) => (
            <Link
              key={w.id}
              href={`/perfil/pontos?lugar=${w.restaurant.id}`}
              className={`chip-link shrink-0 ${active?.id === w.id ? 'chip-link-active' : ''}`}
              aria-current={active?.id === w.id ? 'true' : undefined}
            >
              {w.restaurant.name}
            </Link>
          ))}
        </nav>
      )}

      {history.length === 0 ? (
        <p className="glass-panel-sm p-4 text-sm text-slate-600">Ainda não há movimentações. Peça o QR Code no caixa depois de pagar.</p>
      ) : (
        <ul className="glass-panel-sm divide-y divide-slate-200/70">
          {history.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-3 p-4 text-sm">
              <div className="min-w-0">
                <p className="font-semibold text-slate-800">{t.description}</p>
                <p className="text-xs text-slate-500">{t.wallet.restaurant.name} · {formatDateTimeBR(t.createdAt)}</p>
              </div>
              <span className={`shrink-0 font-bold ${t.type === 'EARN' ? 'text-emerald-600' : 'text-slate-500'}`}>
                {t.type === 'EARN' ? '+' : '−'}{formatPoints(t.points)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {history.length === 100 && <p className="text-center text-xs text-slate-500">Mostrando as 100 movimentações mais recentes.</p>}
    </main>
  );
}
