import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState';
import type { Prisma } from '@prisma/client';
import { normalizeAccountCode } from '@/lib/account-code';
import { maskCpf, formatPhone, onlyDigits } from '@/lib/br';
import { prisma } from '@/lib/db';
import { formatDateTimeBR, formatPoints } from '@/lib/points';
import { requireActiveRestaurant } from '@/lib/session';
import { Icon } from '@/components/Icons';
import { PlaceAvatar } from '@/components/Visual';
import { dateKeyOf, todayKey } from '@/lib/booking';
import { loadCustomerRows } from '@/lib/insights-db';
import { SEGMENT_HINT, SEGMENT_LABEL, type Segment } from '@/lib/insights';

export const metadata = { title: 'Clientes' };
export const dynamic = 'force-dynamic';

const LIMIT = 100;

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ q?: string; seg?: string }> }) {
  const restaurant = await requireActiveRestaurant();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? '';
  const seg = (['novos', 'fieis', 'quase', 'sumidos'] as const).find((x) => x === sp.seg) as Segment | undefined;
  const digits = onlyDigits(q);

  const customerFilter: Prisma.CustomerWhereInput | undefined = q
    ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, ...(normalizeAccountCode(q) ? [{ accountCode: normalizeAccountCode(q)! }] : []), ...(digits ? [{ cpf: { contains: digits } }, { phone: { contains: digits } }] : [])] }
    : undefined;

  const { rows: allRows } = await loadCustomerRows(restaurant.id);
  const counts: Record<Segment, number> = { novos: 0, fieis: 0, quase: 0, sumidos: 0 };
  for (const r of allRows) for (const sg of r.segments) counts[sg] += 1;
  const segOf = new Map(allRows.map((r) => [r.customerId, r.segments]));
  const inSegment = seg ? allRows.filter((r) => r.segments.includes(seg)).map((r) => r.customerId) : null;

  const [total, wallets] = await Promise.all([
    prisma.wallet.count({ where: { restaurantId: restaurant.id } }),
    prisma.wallet.findMany({
      where: { restaurantId: restaurant.id, ...(inSegment ? { customerId: { in: inSegment } } : {}), ...(customerFilter ? { customer: customerFilter } : {}) },
      include: { customer: { select: { id: true, name: true, cpf: true, phone: true } } },
      orderBy: { balance: 'desc' },
      take: LIMIT,
    }),
  ]);

  // Totais por carteira (ganhos, resgates, última atividade) numa única consulta agregada.
  const stats = await prisma.transaction.groupBy({
    by: ['walletId', 'type'],
    where: { walletId: { in: wallets.map((w) => w.id) } },
    _sum: { points: true },
    _count: true,
    _max: { createdAt: true },
  });
  const byWallet = new Map<string, { earned: number; redeemed: number; visits: number; last?: Date }>();
  for (const s of stats) {
    const cur = byWallet.get(s.walletId) ?? { earned: 0, redeemed: 0, visits: 0 };
    if (s.type === 'EARN') {
      cur.earned += s._sum.points ?? 0;
      cur.visits += s._count;
    } else if (s.type === 'REDEEM') cur.redeemed += s._sum.points ?? 0;
    const last = s._max.createdAt ?? undefined;
    if (last && (!cur.last || last > cur.last)) cur.last = last;
    byWallet.set(s.walletId, cur);
  }

  const SEG_COLOR: Record<Segment, string> = { novos: '#2150C9', fieis: '#15803d', quase: '#B45309', sumidos: '#e11d48' };
  const SEG_CHIP: Record<Segment, string> = { novos: 'chip-lima', fieis: 'chip-verde', quase: 'glass-chip', sumidos: 'chip-sumido' };
  const today = todayKey();
  const ago = (d: Date) => {
    const n = Math.round((Date.parse(today) - Date.parse(dateKeyOf(d))) / 86_400_000);
    return n <= 0 ? 'hoje' : n === 1 ? 'ontem' : `há ${n} dias`;
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2 px-1">
        <div>
          <h1 className="text-xl font-bold text-primary">Clientes</h1>
          <p className="text-sm text-slate-500">
            {formatPoints(total)} {total === 1 ? 'cliente tem' : 'clientes têm'} carteira no seu estabelecimento. Toque em um cliente para ver todo o histórico.
          </p>
        </div>
        {seg && <Link href="/dashboard/clientes" className="link-inline text-sm">Mostrar todos ({total})</Link>}
      </div>

      <nav aria-label="Segmentos" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(Object.keys(SEGMENT_LABEL) as Segment[]).map((k) => (
          <Link
            key={k}
            href={`/dashboard/clientes?seg=${k}`}
            aria-current={seg === k ? 'true' : undefined}
            title={SEGMENT_HINT[k]}
            data-testid={`seg-${k}`}
            className={`glass-panel-sm card-link block !rounded-2xl border-t-4 px-4 py-3 ${seg === k ? 'ring-2 ring-[#0f1f3d]' : ''}`}
            style={{ borderTopColor: SEG_COLOR[k] }}
          >
            <span className="block text-sm font-semibold text-slate-600">{SEGMENT_LABEL[k]}</span>
            <span className="block text-3xl font-extrabold tracking-tight text-primary">{counts[k]}</span>
          </Link>
        ))}
      </nav>
      {seg && <p className="px-1 text-sm text-slate-600">{SEGMENT_HINT[seg]}</p>}

      <section className="glass-panel !rounded-[22px] p-3 sm:p-4">
        <form className="mb-2 flex gap-2" role="search" autoComplete="off">
          {seg && <input type="hidden" name="seg" value={seg} />}
          <div className="relative min-w-0 flex-1">
            <Icon name="search" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input name="q" defaultValue={q} className="glass-input !pl-11" placeholder="Buscar por nome, CPF, telefone ou ID da conta" aria-label="Buscar cliente" />
          </div>
          <button className="glass-button-ghost !w-auto">Buscar</button>
        </form>

        {wallets.length === 0 ? (
          <EmptyState
            variant="users"
            title={q ? 'Nenhum cliente encontrado' : seg ? 'Ninguém neste grupo por enquanto' : 'Ainda não há clientes'}
            text={q ? 'Confira o nome, o CPF ou o telefone e tente de novo.' : seg ? 'Os grupos se atualizam sozinhos conforme os clientes compram.' : 'Eles aparecem aqui quando leem o primeiro QR Code. Lance uma compra no caixa para começar.'}
            action={q || seg ? undefined : { href: '/dashboard/caixa', label: 'Abrir o Caixa' }}
          />
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,2.2fr)_6rem_9rem_minmax(0,1.4fr)] gap-3 border-b border-slate-100 px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 md:grid" aria-hidden>
              <span>Cliente</span><span>Saldo</span><span>Última visita</span><span>Grupo</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {wallets.map((w) => {
                const s = byWallet.get(w.id) ?? { earned: 0, redeemed: 0, visits: 0 };
                const groups = segOf.get(w.customer.id) ?? [];
                return (
                  <li key={w.id}>
                    <Link href={`/dashboard/clientes/${w.customer.id}`} className="card-link grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 rounded-2xl px-3 py-3 md:grid-cols-[minmax(0,2.2fr)_6rem_9rem_minmax(0,1.4fr)]">
                      <div className="flex min-w-0 items-center gap-3">
                        <PlaceAvatar name={w.customer.name} src={null} size={40} />
                        <div className="min-w-0">
                          <p className="truncate font-bold text-slate-800">{w.customer.name}</p>
                          <p className="truncate text-xs text-slate-500">CPF {maskCpf(w.customer.cpf)} · {formatPhone(w.customer.phone)}</p>
                        </div>
                      </div>
                      <p className="text-right font-semibold text-slate-700 md:text-left">{formatPoints(w.balance)} pts</p>
                      <p className="col-span-2 text-xs text-slate-600 md:col-span-1 md:text-sm">
                        <span className="md:hidden">Última visita: </span>
                        <span title={s.last ? formatDateTimeBR(s.last) : undefined}>{s.last ? ago(s.last) : '—'}</span>
                        <span className="block text-[11px] text-slate-400">{s.visits} {s.visits === 1 ? 'pontuação' : 'pontuações'} · {formatPoints(s.earned)} recebidos · {formatPoints(s.redeemed)} usados</span>
                      </p>
                      <p className="col-span-2 flex flex-wrap gap-1.5 md:col-span-1">
                        {groups.length === 0 ? <span className="text-xs text-slate-400">—</span> : groups.map((g) => <span key={g} className={SEG_CHIP[g]}>{SEGMENT_LABEL[g]}</span>)}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <div className="flex flex-wrap gap-2.5">
        <a href="/dashboard/exportar/clientes" download className="glass-button-ghost !w-auto"><Icon name="receipt" size={17} /> Planilha de clientes (CSV)</a>
        <a href="/dashboard/exportar/lancamentos" download className="glass-button-ghost !w-auto"><Icon name="chart" size={17} /> Planilha de lançamentos</a>
      </div>
      {total > LIMIT && !q && <p className="text-center text-xs text-slate-500">Mostrando os {LIMIT} clientes com mais pontos. Use a busca para encontrar os demais.</p>}
    </div>
  );
}
