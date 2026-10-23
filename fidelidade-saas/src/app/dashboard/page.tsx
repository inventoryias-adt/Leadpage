import Link from 'next/link';
import { BarList, KpiCard, PeakHeatmap, SalesArea } from '@/components/DashboardCharts';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icons';
import { unreadConversations } from '@/lib/chat-db';
import { prisma } from '@/lib/db';
import { dailySeries, deltaPct, heatmap, peakSlot, suggestions, WEEKDAYS } from '@/lib/insights';
import { loadCustomerRows } from '@/lib/insights-db';
import { compactBRL, compactNumber, formatBRL, formatPoints } from '@/lib/points';
import { formatAvg, summarize } from '@/lib/reviews';
import { requireActiveRestaurant } from '@/lib/session';

export const metadata = { title: 'Início' };
export const dynamic = 'force-dynamic';

const PERIODS = [7, 30, 90] as const;
const DAY = 24 * 60 * 60 * 1000;

const wa = (phone: string, text: string) => `https://wa.me/55${phone}?text=${encodeURIComponent(text)}`;
const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? n;

export default async function DashboardHome({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const restaurant = await requireActiveRestaurant();
  const requested = Number((await searchParams).dias);
  const days = (PERIODS as readonly number[]).includes(requested) ? requested : 30;
  const now = new Date();
  const since = new Date(now.getTime() - days * DAY);
  const prevSince = new Date(since.getTime() - days * DAY);
  const rid = restaurant.id;

  const [sales, redemptions, wallets, pending, cust, rewards, promosCount, challengesCount, units, heatSales] = await Promise.all([
    prisma.claim.findMany({
      where: { restaurantId: rid, redeemedAt: { gte: prevSince }, amountCents: { gt: 0 } },
      select: { redeemedAt: true, amountCents: true, points: true, customerId: true },
      take: 40000,
    }),
    prisma.redemption.findMany({ where: { restaurantId: rid, createdAt: { gte: prevSince } }, select: { createdAt: true, rewardName: true, pointsCost: true } }),
    prisma.wallet.aggregate({ where: { restaurantId: rid }, _sum: { balance: true }, _count: true }),
    prisma.redemption.count({ where: { restaurantId: rid, status: 'PENDING' } }),
    loadCustomerRows(rid, now),
    prisma.reward.findMany({ where: { restaurantId: rid, active: true, birthdayOnly: false }, select: { imageId: true } }),
    prisma.promotion.count({ where: { restaurantId: rid, active: true, OR: [{ endsAt: null }, { endsAt: { gt: now } }] } }),
    prisma.challenge.count({ where: { restaurantId: rid, active: true } }),
    prisma.unit.findMany({ where: { restaurantId: rid, active: true }, select: { latitude: true, longitude: true } }),
    prisma.claim.findMany({
      where: { restaurantId: rid, redeemedAt: { gte: new Date(now.getTime() - 90 * DAY) }, amountCents: { gt: 0 } },
      select: { redeemedAt: true },
      take: 40000,
    }),
  ]);

  const unreadChats = await unreadConversations('RESTAURANT', rid);
  const postCount = await prisma.post.count({ where: { restaurantId: rid, hiddenAt: null } });
  const reviewSummary = summarize((await prisma.review.findMany({ where: { restaurantId: rid, hiddenAt: null }, select: { placeRating: true } })).map((r) => r.placeRating));
  const inPeriod = (d: Date) => d >= since;
  const cur = sales.filter((s) => s.redeemedAt && inPeriod(s.redeemedAt));
  const prev = sales.filter((s) => s.redeemedAt && !inPeriod(s.redeemedAt));
  const sum = (rows: typeof sales, k: 'amountCents' | 'points') => rows.reduce((n, r) => n + r[k], 0);
  const revenue = sum(cur, 'amountCents');
  const revenuePrev = sum(prev, 'amountCents');
  const ticket = cur.length ? Math.round(revenue / cur.length) : 0;
  const ticketPrev = prev.length ? Math.round(revenuePrev / prev.length) : 0;
  const pointsIssued = sum(cur, 'points');
  const redCur = redemptions.filter((r) => inPeriod(r.createdAt));
  const redPrev = redemptions.length - redCur.length;
  const newCustomers = cust.rows.filter((r) => inPeriod(r.createdAt)).length;
  const buyers = cust.rows.filter((r) => r.purchases >= 1).length;
  const returning = cust.rows.filter((r) => r.purchases >= 2).length;
  const returnRate = buyers ? Math.round((returning / buyers) * 100) : 0;

  const series = dailySeries(cur.map((s) => ({ at: s.redeemedAt as Date, cents: s.amountCents, points: s.points })), days, now);
  const grid = heatmap(heatSales.map((s) => ({ at: s.redeemedAt as Date })));
  const peak = peakSlot(grid);

  // Top clientes do período
  const perCustomer = new Map<string, { cents: number; count: number }>();
  for (const s of cur) {
    if (!s.customerId) continue;
    const r = perCustomer.get(s.customerId) ?? { cents: 0, count: 0 };
    r.cents += s.amountCents;
    r.count += 1;
    perCustomer.set(s.customerId, r);
  }
  const topClients = [...perCustomer.entries()].sort((a, b) => b[1].cents - a[1].cents).slice(0, 5);
  const nameById = new Map(cust.rows.map((r) => [r.customerId, r.name]));

  // Prêmios mais resgatados
  const rewardCount = new Map<string, number>();
  for (const r of redCur) rewardCount.set(r.rewardName, (rewardCount.get(r.rewardName) ?? 0) + 1);
  const topRewards = [...rewardCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, value]) => ({ label, value }));

  // Oportunidades: quem está perto do prêmio e quem sumiu
  const quase = cust.rows.filter((r) => r.segments.includes('quase')).sort((a, b) => b.balance - a.balance);
  const sumidos = cust.rows.filter((r) => r.segments.includes('sumidos')).sort((a, b) => b.balance - a.balance);
  const cheapest = cust.minReward;
  const cheapestName = cheapest
    ? (await prisma.reward.findFirst({ where: { restaurantId: rid, active: true, birthdayOnly: false, pointsCost: cheapest }, select: { name: true } }))?.name ?? 'o prêmio'
    : null;

  const tips = suggestions({
    customers: wallets._count,
    purchasesInPeriod: cur.length,
    promosCount,
    challengesCount,
    rewardsCount: rewards.length,
    rewardsWithoutPhoto: rewards.filter((r) => !r.imageId).length,
    unitsWithoutLocation: units.filter((u) => u.latitude == null || u.longitude == null).length,
    referralPoints: restaurant.referralPoints,
    checkInPoints: restaurant.checkInPoints,
    hasLogo: !!restaurant.logoImageId,
    hasCover: !!restaurant.coverImageId,
    sumidos: sumidos.length,
    quase: quase.length,
    peak,
  });

  const empty = wallets._count === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-primary">Painel</h1>
          <p className="text-sm text-slate-600">Como está o seu estabelecimento nos últimos {days} dias.</p>
        </div>
        <div className="flex items-center gap-3">
          <nav aria-label="Período" className="flex gap-1.5">
            {PERIODS.map((p) => (
              <Link key={p} href={`/dashboard?dias=${p}`} aria-current={p === days ? 'true' : undefined} className={`chip-link ${p === days ? 'chip-link-active' : ''}`}>
                {p} dias
              </Link>
            ))}
          </nav>
          <Link href="/dashboard/caixa" className="glass-button btn-sm hidden sm:inline-flex"><Icon name="receipt" size={16} /> Lançar pontos</Link>
        </div>
      </div>

      <Link href="/dashboard/caixa" className="glass-button py-4 text-lg sm:hidden"><Icon name="receipt" size={22} /> Lançar pontos no caixa</Link>

      {empty && (
        <EmptyState
          variant="coin"
          title="O primeiro ponto está a um QR Code de distância"
          text="Quando o cliente pagar a conta, lance o valor no caixa e mostre o QR Code. A carteira dele é criada na hora."
          action={{ href: '/dashboard/caixa', label: 'Lançar a primeira compra' }}
        />
      )}

      <div className="glass-panel !rounded-[22px] overflow-hidden !p-0" data-testid="kpi-faixa">
      <div className="grid grid-cols-2 gap-px bg-slate-200/70 lg:grid-cols-4">
        <div className="bg-white"><KpiCard label="Vendas lançadas" value={compactBRL(revenue)} exact={formatBRL(revenue)} hint={`${cur.length} ${cur.length === 1 ? 'compra' : 'compras'}`} delta={deltaPct(revenue, revenuePrev)} /></div>
        <div className="bg-white"><KpiCard label="Ticket médio" value={compactBRL(ticket)} exact={formatBRL(ticket)} hint="por compra" delta={deltaPct(ticket, ticketPrev)} /></div>
        <Link href="/dashboard/pontos" className="block bg-white transition-colors hover:bg-[#f3f6fd]"><KpiCard label="Pontos emitidos" value={compactNumber(pointsIssued)} exact={formatPoints(pointsIssued)} hint="creditados aos clientes" delta={deltaPct(pointsIssued, sum(prev, 'points'))} /></Link>
        <Link href="/dashboard/resgates?st=todos&periodo=mes" className="block bg-white transition-colors hover:bg-[#f3f6fd]"><KpiCard label="Resgates" value={compactNumber(redCur.length)} hint={`${pending} ${pending === 1 ? 'prêmio a entregar' : 'prêmios a entregar'}`} delta={deltaPct(redCur.length, redPrev)} /></Link>
        <Link href="/dashboard/clientes" className="block bg-white transition-colors hover:bg-[#f3f6fd]"><KpiCard label="Clientes na carteira" value={compactNumber(wallets._count)} hint="ver todos →" /></Link>
        <Link href="/dashboard/clientes?seg=novos" className="block bg-white transition-colors hover:bg-[#f3f6fd]"><KpiCard label="Clientes novos" value={compactNumber(newCustomers)} hint={`nos últimos ${days} dias`} /></Link>
        <div className="bg-white"><KpiCard label="Taxa de retorno" value={`${returnRate}%`} hint="clientes com 2+ compras" /></div>
        <div className="bg-white"><KpiCard label="Pontos em circulação" value={compactNumber(wallets._sum.balance ?? 0)} exact={formatPoints(wallets._sum.balance ?? 0)} hint="saldo ainda não resgatado" /></div>
      </div>
      </div>


      <Link href="/dashboard/avaliacoes" className="glass-panel-sm card-link flex items-center justify-between gap-3 !rounded-[22px] p-4" data-testid="reviews-shortcut">
        <span className="flex items-center gap-2 font-semibold text-primary"><Icon name="star" size={18} /> Avaliações dos clientes</span>
        <span className="text-sm text-slate-600">
          {reviewSummary.count === 0 ? 'Ainda sem avaliações' : <><b className="text-slate-900">★ {formatAvg(reviewSummary.avg ?? 0)}</b> · {reviewSummary.count} {reviewSummary.count === 1 ? 'avaliação' : 'avaliações'} · ver e responder →</>}
        </span>
      </Link>

      <Link href="/dashboard/mensagens" className="glass-panel-sm card-link flex items-center justify-between gap-3 !rounded-[22px] p-4" data-testid="chats-shortcut">
        <span className="flex items-center gap-2 font-semibold text-primary"><Icon name="chat" size={18} /> Mensagens dos clientes</span>
        <span className="text-sm text-slate-600">{unreadChats > 0 ? <b className="text-rose-600">{unreadChats} {unreadChats === 1 ? 'conversa nova' : 'conversas novas'} · responder →</b> : 'Fale com seus clientes →'}</span>
      </Link>

      <Link href="/dashboard/indicacoes" className="glass-panel-sm card-link flex items-center justify-between gap-3 !rounded-[22px] p-4" data-testid="posts-shortcut">
        <span className="flex items-center gap-2 font-semibold text-primary"><Icon name="camera" size={18} /> Indicações dos clientes</span>
        <span className="text-sm text-slate-600">{postCount === 0 ? 'Ainda sem fotos' : <><b className="text-slate-900">{postCount}</b> {postCount === 1 ? 'indicação' : 'indicações'} · ver →</>}</span>
      </Link>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="glass-panel min-w-0 p-5 sm:p-6 lg:col-span-3" aria-labelledby="vendas-dia">
          <div className="mb-1 flex items-baseline justify-between gap-3"><h2 id="vendas-dia" className="font-semibold text-primary">Vendas por dia</h2><Link href={`/dashboard/vendas?dias=${days}`} className="shrink-0 text-xs font-bold text-electric-600" data-testid="open-vendas">Abrir tela cheia ›</Link></div>
          <p className="mb-3 text-sm text-slate-500">Soma das compras lançadas no caixa e lidas pelos clientes. Toque num dia para ver o que aconteceu.</p>
          {cur.length === 0 ? (
            <EmptyState compact variant="chart" title="Sem compras neste período" text="Quando houver lançamentos, as vendas de cada dia aparecem aqui." />
          ) : (
            <SalesArea days={series} />
          )}
        </section>
        <section className="glass-panel min-w-0 p-5 sm:p-6 lg:col-span-2" aria-labelledby="picos">
          <div className="mb-1 flex items-baseline justify-between gap-3"><h2 id="picos" className="font-semibold text-primary">Dias e horários de pico</h2><Link href="/dashboard/horarios" className="shrink-0 text-xs font-bold text-electric-600" data-testid="open-horarios">Abrir tela cheia ›</Link></div>
          <p className="mb-4 text-sm text-slate-500">
            {peak ? <>Seu movimento é maior na <strong className="text-slate-800">{WEEKDAYS[peak.dow]}, perto das {peak.hour}h</strong>. Últimos 90 dias.</> : 'Mostra quando os clientes mais compram (últimos 90 dias).'}
          </p>
          <PeakHeatmap grid={grid} />
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="glass-panel p-5 sm:p-6" aria-labelledby="quase-la">
          <h2 id="quase-la" className="mb-1 font-semibold text-primary">Quase lá</h2>
          <p className="mb-4 text-sm text-slate-500">Clientes perto do prêmio mais barato. Um aviso agora vira visita.</p>
          {quase.length === 0 ? (
            <p className="text-sm text-slate-500">Ninguém está perto do primeiro prêmio no momento.</p>
          ) : (
            <ul className="divide-y divide-[#E5E7EB]">
              {quase.slice(0, 5).map((c) => (
                <li key={c.customerId} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-slate-800">{c.name}</span>
                    <span className="text-xs text-slate-500">{formatPoints(c.balance)} pts · faltam {formatPoints((cheapest ?? 0) - c.balance)}</span>
                  </span>
                  <a className="glass-button-ghost btn-sm shrink-0" target="_blank" rel="noopener noreferrer" href={wa(c.phone, `Oi ${firstName(c.name)}! Faltam só ${(cheapest ?? 0) - c.balance} pontos para você resgatar ${cheapestName} no ${restaurant.name}. Passa aqui e aproveita!`)}>
                    Avisar
                  </a>
                </li>
              ))}
            </ul>
          )}
          {quase.length > 5 && <Link href="/dashboard/clientes?seg=quase" className="link-inline mt-3 inline-block text-sm">Ver os {quase.length} →</Link>}
        </section>

        <section className="glass-panel p-5 sm:p-6" aria-labelledby="sumidos">
          <h2 id="sumidos" className="mb-1 font-semibold text-primary">Para reconquistar</h2>
          <p className="mb-4 text-sm text-slate-500">Clientes que não compram há 30 dias ou mais.</p>
          {sumidos.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum cliente sumido por enquanto. Ótimo sinal.</p>
          ) : (
            <ul className="divide-y divide-[#E5E7EB]">
              {sumidos.slice(0, 5).map((c) => {
                const d = c.lastPurchaseAt ? Math.floor((now.getTime() - c.lastPurchaseAt.getTime()) / DAY) : null;
                return (
                  <li key={c.customerId} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-slate-800">{c.name}</span>
                      <span className="text-xs text-slate-500">{d != null ? `há ${d} dias` : 'sem compra'} · {formatPoints(c.balance)} pts</span>
                    </span>
                    <a className="glass-button-ghost btn-sm shrink-0" target="_blank" rel="noopener noreferrer" href={wa(c.phone, `Oi ${firstName(c.name)}! Faz um tempo que não te vemos no ${restaurant.name}.${c.balance > 0 ? ` Você tem ${c.balance} pontos esperando por você.` : ''} Vem nos visitar!`)}>
                      Chamar
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
          {sumidos.length > 5 && <Link href="/dashboard/clientes?seg=sumidos" className="link-inline mt-3 inline-block text-sm">Ver os {sumidos.length} →</Link>}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="glass-panel p-5 sm:p-6" aria-labelledby="top-clientes">
          <h2 id="top-clientes" className="mb-4 font-semibold text-primary">Melhores clientes do período</h2>
          {topClients.length === 0 ? (
            <p className="text-sm text-slate-500">Ainda sem compras no período.</p>
          ) : (
            <ol className="space-y-3">
              {topClients.map(([id, v], i) => (
                <li key={id}>
                  <Link href={`/dashboard/clientes/${id}`} className="flex items-center gap-3 rounded-lg border border-transparent p-2 transition-colors hover:border-slate-300 hover:bg-[#EDF0F5]">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-electric-500/10 text-sm font-bold text-electric-600">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-slate-800">{nameById.get(id) ?? 'Cliente'}</span>
                      <span className="text-xs text-slate-500">{v.count} {v.count === 1 ? 'compra' : 'compras'}</span>
                    </span>
                    <span className="shrink-0 font-bold text-primary">{formatBRL(v.cents)}</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section className="glass-panel p-5 sm:p-6" aria-labelledby="premios-top">
          <h2 id="premios-top" className="mb-4 font-semibold text-primary">Prêmios mais resgatados</h2>
          {topRewards.length === 0 ? (
            <EmptyState compact variant="gift" title="Nenhum resgate no período" text="Os prêmios mais pedidos pelos clientes aparecem aqui." />
          ) : (
            <BarList items={topRewards} unit="resgates" />
          )}
        </section>

      </div>

      <section className="glass-panel p-5 sm:p-6" aria-labelledby="ideias">
        <h2 id="ideias" className="mb-1 font-semibold text-primary">Ideias para vender mais</h2>
        <p className="mb-4 text-sm text-slate-500">Sugestões escolhidas pelo que os seus números mostram.</p>
        {tips.length === 0 ? (
          <EmptyState compact variant="shield" title="Tudo em dia por aqui" text="Você já usa as principais ferramentas. Acompanhe os números e teste campanhas novas." />
        ) : (
          <ul className="space-y-3">
            {tips.map((t) => (
              <li key={t.id} className="glass-inset flex items-start justify-between gap-3 p-3.5">
                <span className="min-w-0">
                  <span className="block font-semibold text-slate-800">{t.title}</span>
                  <span className="text-sm text-slate-600">{t.text}</span>
                </span>
                <Link href={t.href} className="glass-button-ghost btn-sm shrink-0">{t.cta}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
