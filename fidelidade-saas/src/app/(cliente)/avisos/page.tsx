import Link from 'next/link';
import { Icon } from '@/components/Icons';
import { Illustration } from '@/components/Illustrations';
import { MarkAllRead } from '@/components/MarkAllRead';
import { NoticeDay } from '@/components/NoticeDay';
import { NextBookingCard } from '@/components/NextBookingCard';
import { PlaceAvatar } from '@/components/Visual';
import { prisma } from '@/lib/db';
import { imageUrl } from '@/lib/images';
import { noticeKind } from '@/lib/notice-kind';
import { groupByDay, monthsOf, monthRange, parseMonthKey } from '@/lib/notice-groups';
import { colorOf } from '@/lib/palette';
import { hmOf } from '@/lib/booking';
import { requireCustomer } from '@/lib/session';

export const metadata = { title: 'Avisos' };
export const dynamic = 'force-dynamic';

const LIMIT = 150;

export default async function AvisosPage({ searchParams }: { searchParams: Promise<{ lugar?: string; mes?: string; presenca?: string; liberado?: string; erro?: string }> }) {
  const customer = await requireCustomer('/avisos');
  const sp = await searchParams;
  const now = new Date();

  const [perPlace, unreadPerPlace, asking] = await Promise.all([
    prisma.notification.groupBy({ by: ['restaurantId'], where: { customerId: customer.id }, _count: { _all: true } }),
    prisma.notification.groupBy({ by: ['restaurantId'], where: { customerId: customer.id, readAt: null }, _count: { _all: true } }),
    // Lembrete enviado e ainda sem resposta: "Sim, estarei lá" / "Liberar" direto nos avisos.
    prisma.booking.findMany({
      where: { customerId: customer.id, status: { in: ['PENDING', 'CONFIRMED'] }, reminderSentAt: { not: null }, reminderAnswer: null, endsAt: { gt: now } },
      orderBy: { startsAt: 'asc' },
      include: { restaurant: { select: { name: true } }, resource: { select: { name: true } } },
    }),
  ]);
  const placeIds = perPlace.map((p) => p.restaurantId).filter((x): x is string => !!x);
  const places = placeIds.length ? await prisma.restaurant.findMany({ where: { id: { in: placeIds } }, select: { id: true, name: true, logoImageId: true } }) : [];
  const placeById = new Map(places.map((p) => [p.id, p]));
  const total = perPlace.reduce((n, p) => n + p._count._all, 0);
  const unreadTotal = unreadPerPlace.reduce((n, p) => n + p._count._all, 0);
  const unreadOf = (id: string) => unreadPerPlace.find((p) => p.restaurantId === id)?._count._all ?? 0;

  const filter = sp.lugar && placeById.has(sp.lugar) ? sp.lugar : null; // só aceita lugar que tem aviso deste cliente
  const placeWhere = { customerId: customer.id, ...(filter ? { restaurantId: filter } : {}) };
  const monthRows = await prisma.notification.findMany({ where: placeWhere, select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 5000 });
  const months = monthsOf(monthRows.map((r) => r.createdAt));
  const mes = parseMonthKey(sp.mes) && months.some((m) => m.key === sp.mes) ? (sp.mes as string) : null; // só aceita mês que tem aviso
  const range = mes ? monthRange(mes) : null;
  const items = await prisma.notification.findMany({
    where: { ...placeWhere, ...(range ? { createdAt: { gte: range.from, lt: range.to } } : {}) },
    orderBy: { createdAt: 'desc' },
    take: LIMIT,
  });
  const groups = groupByDay(items, now);
  const inScope = mes ? (months.find((m) => m.key === mes)?.count ?? 0) : filter ? (perPlace.find((p) => p.restaurantId === filter)?._count._all ?? 0) : total;
  const shown = inScope;
  const href = (lugar: string | null, mesKey: string | null) => {
    const q = new URLSearchParams();
    if (lugar) q.set('lugar', lugar);
    if (mesKey) q.set('mes', mesKey);
    const qs = q.toString();
    return qs ? `/avisos?${qs}` : '/avisos';
  };
  const unreadShown = filter ? unreadOf(filter) : unreadTotal;
  const choices = places.map((p) => ({ ...p, count: perPlace.find((x) => x.restaurantId === p.id)?._count._all ?? 0 })).sort((a, b) => unreadOf(b.id) - unreadOf(a.id) || b.count - a.count);

  return (
    <main className="p-4 sm:p-6 md:pt-8">
      <header className="mb-4">
        <h1 className="text-2xl font-extrabold tracking-tight text-primary md:text-3xl">Avisos</h1>
        <p className="text-sm text-slate-600">
          {unreadTotal > 0 ? <><span className="chip-lima">{unreadTotal} {unreadTotal === 1 ? 'novo' : 'novos'}</span>{' '}</> : null}
          Pontos recebidos, pedidos, horários e prêmios. Toque em uma data para ver.
        </p>
        {unreadShown > 0 && <div className="mt-1"><MarkAllRead restaurantId={filter ?? undefined} /></div>}
      </header>

      {sp.presenca && <p role="status" className="glass-success mx-auto mb-4 max-w-2xl">Presença confirmada. Até já!</p>}
      {sp.liberado && <p role="status" className="glass-success mx-auto mb-4 max-w-2xl">Horário liberado para outra pessoa.</p>}
      {sp.erro && <p role="alert" className="glass-error mx-auto mb-4 max-w-2xl">{sp.erro}</p>}

      {asking.length > 0 && (
        <ul className="mx-auto mb-5 max-w-2xl space-y-3" aria-label="Horários para confirmar">
          {asking.map((b) => <li key={b.id}><NextBookingCard booking={b} back="/avisos" /></li>)}
        </ul>
      )}

      {choices.length > 1 && (
        <nav aria-label="Filtrar por estabelecimento" className="chip-row mx-auto mb-4 max-w-2xl">
          <Link href={href(null, mes)} aria-current={!filter ? 'true' : undefined} className={`chip-link shrink-0 gap-1.5 ${!filter ? 'chip-link-active' : ''}`}>
            Todos <span className="text-xs font-bold opacity-70">{total}</span>
          </Link>
          {choices.map((p) => (
            <Link key={p.id} href={href(p.id, mes)} aria-current={filter === p.id ? 'true' : undefined} className={`chip-link shrink-0 gap-2 !py-1 ${filter === p.id ? 'chip-link-active' : ''}`}>
              <PlaceAvatar name={p.name} src={imageUrl(p.logoImageId)} size={24} /> {p.name}
              {unreadOf(p.id) > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold leading-4 text-white" aria-label={`${unreadOf(p.id)} novos`}>{unreadOf(p.id)}</span>}
            </Link>
          ))}
        </nav>
      )}

      {months.length > 1 && (
        <nav aria-label="Filtrar por mês" className="chip-row mx-auto mb-4 max-w-2xl">
          <Link href={href(filter, null)} aria-current={!mes ? 'true' : undefined} className={`chip-link shrink-0 gap-1.5 !py-1 ${!mes ? 'chip-link-active' : ''}`}>
            Todos os meses
          </Link>
          {months.map((m) => (
            <Link key={m.key} href={href(filter, m.key)} aria-current={mes === m.key ? 'true' : undefined} className={`chip-link shrink-0 gap-1.5 !py-1 ${mes === m.key ? 'chip-link-active' : ''}`}>
              {m.label} <span className="text-xs font-bold opacity-70">{m.count}</span>
            </Link>
          ))}
        </nav>
      )}

      {groups.length === 0 ? (
        asking.length === 0 && (
          <div className="glass-panel mx-auto flex max-w-xl flex-col items-center p-6 text-center">
            <Illustration variant="empty" size={150} />
            <p className="font-bold text-slate-800">Nenhum aviso por enquanto</p>
            <p className="mt-1 max-w-xs text-sm text-slate-600">Quando você ganhar pontos ou estiver perto de um prêmio, avisamos por aqui.</p>
          </div>
        )
      ) : (
        <div className="mx-auto max-w-2xl space-y-2" data-testid="notice-groups">
          {groups.map((g) => (
            <NoticeDay key={g.key} label={g.label} count={g.items.length} unreadIds={g.items.filter((n) => !n.readAt).map((n) => n.id)}>
              <ul className="glass-panel divide-y divide-slate-100 !rounded-[20px] overflow-hidden">
                {g.items.map((n) => {
                  const kind = noticeKind(n);
                  const tone = colorOf(kind.color);
                  const place = n.restaurantId ? placeById.get(n.restaurantId) : null;
                  const row = (
                    <div className={`flex items-start gap-3 px-4 py-3 ${n.readAt ? '' : 'bg-[#F3F7FF]'}`}>
                      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={n.readAt ? { background: '#F1F5F9', color: '#64748B' } : { background: tone.soft, color: tone.hex }}>
                        <Icon name={kind.icon} size={20} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`leading-snug text-slate-900 ${n.readAt ? 'font-semibold' : 'font-bold'}`}>{n.title}</p>
                          <span className="shrink-0 pt-0.5 text-xs text-slate-400">{hmOf(n.createdAt)}</span>
                        </div>
                        <p className="line-clamp-2 text-sm text-slate-600">{n.body}</p>
                        {place && !filter && <p className="mt-1 truncate text-xs font-semibold" style={{ color: tone.hex }}>{place.name}</p>}
                      </div>
                      {!n.readAt && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-electric-600" aria-label="Novo" />}
                    </div>
                  );
                  return <li key={n.id}>{n.href ? <Link href={n.href} className="card-link block">{row}</Link> : row}</li>;
                })}
              </ul>
            </NoticeDay>
          ))}
          {shown > items.length && <p className="pt-3 text-center text-xs text-slate-500">Mostrando os {items.length} avisos mais recentes de {shown}.</p>}
        </div>
      )}
    </main>
  );
}
